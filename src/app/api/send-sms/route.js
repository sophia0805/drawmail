import twilio from 'twilio';
import { createServer } from 'http';
import { spawn } from 'child_process';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function startTempFileServer(imageBuffer, port = 3001) {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.url === '/image.png') {
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': imageBuffer.length,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(imageBuffer);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`Temp server listening on 0.0.0.0:${port}`);
      resolve(server);
    });

    server.on('error', reject);
  });
}

function startNgrok(port) {
  return new Promise((resolve, reject) => {
    const ngrok = spawn('ngrok', ['http', port.toString()]);
    
    let publicUrl = '';
    let attempts = 0;
    const maxAttempts = 30;
    
    const checkInterval = setInterval(() => {
      attempts++;
      fetch(`http://localhost:4040/api/tunnels`)
        .then(response => response.json())
        .then(data => {
          if (data.tunnels && data.tunnels.length > 0) {
            const httpsTunnel = data.tunnels.find(t => t.proto === 'https');
            if (httpsTunnel) {
              publicUrl = httpsTunnel.public_url;
              clearInterval(checkInterval);
              resolve({ ngrok, publicUrl });
            }
          }
        })
        .catch(() => {
        });
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        reject(new Error('ngrok timeout - could not establish tunnel'));
      }
    }, 1000);
    
    ngrok.stderr.on('data', (data) => {
      console.error('ngrok error:', data.toString());
    });
  });
}

export async function POST(request) {
  let tempServer = null;
  let ngrokProcess = null;
  
  try {
    const { phoneNumber, message, imageData } = await request.json();
    
    if (!phoneNumber) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    let smsMessage = message || 'Check out my drawing!';
    let mediaUrl = null;
    
    if (imageData) {
      try {
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');
        tempServer = await startTempFileServer(imageBuffer, 3001);
        console.log('Temp server started on port 3001');
        
        try {
          const localTest = await fetch('http://localhost:3001/image.png');
          console.log('✅ Local server test successful:', localTest.status);
        } catch (localError) {
          console.log('❌ Local server test failed:', localError.message);
        }
        const { ngrok, publicUrl: ngrokUrl } = await startNgrok(3001);
        ngrokProcess = ngrok;
        console.log('ngrok URL:', ngrokUrl);
        console.log('Full image URL:', `${ngrokUrl}/image.png`);
        await new Promise(resolve => setTimeout(resolve, 5000));
        const cdnResponse = await fetch('https://cdn.hackclub.com/api/v3/new', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer beans',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([`${ngrokUrl}/image.png`])
        });

        if (!cdnResponse.ok) {
          const errorText = await cdnResponse.text();
          throw new Error(`CDN upload failed: ${cdnResponse.status} - ${errorText}`);
        }

        const cdnResult = await cdnResponse.json();
        console.log('CDN response:', cdnResult);
        
        if (cdnResult.files && cdnResult.files.length > 0) {
          mediaUrl = cdnResult.files[0].deployedUrl;
          smsMessage = `${message || 'Check out my drawing!'} ${mediaUrl}`;
          console.log('Image uploaded to CDN:', mediaUrl);
        }
        
      } catch (error) {
        console.error('CDN upload error:', error);
      }
    }


    return Response.json({ 
      success: true, 
      message: 'ngrok tunnel test completed',
      mediaUrl: mediaUrl || null
    });

  } catch (error) {
    console.error('API error:', error);
    return Response.json({ 
      error: error.message || 'Failed to process request' 
    }, { status: 500 });
  } finally {
    if (ngrokProcess) {
      ngrokProcess.kill();
    }
    if (tempServer) {
      tempServer.close();
    }
  }
} 