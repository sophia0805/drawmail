import { createServer } from 'http';
import { spawn } from 'child_process';

function startFileServer(imageBuffer, port = 3001) {
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
        tempServer = await startFileServer(imageBuffer, 3001);
        console.log('Temp server started on port 3001');
        
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

        const cdnResult = await cdnResponse.json();
        
        if (cdnResult.files && cdnResult.files.length > 0) {
          mediaUrl = cdnResult.files[0].deployedUrl;
          smsMessage = `${message || 'Check out my drawing!'} ${mediaUrl}`;
          console.log('Image uploaded to CDN:', mediaUrl);
        }
        
        const convertResponse = await fetch('https://rest.clicksend.com/v3/uploads?convert=mms', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from('normal.emma.brown@gmail.com:AD438B1C-C8E5-5B90-8703-2DFA3761D8F1').toString('base64')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              file_url: mediaUrl  // Use the CDN URL instead of base64 data
            })
          });
        
          if (convertResponse.ok) {
            const convertResult = await convertResponse.json();
            mediaUrl = convertResult.data.url; // Use the converted image URL
            console.log('Image converted by ClickSend:', mediaUrl);
          } else {
            console.error('ClickSend conversion failed:', convertResponse.status);
          }
      } catch (error) {
        console.error('CDN upload error:', error);
      }
    }

    const clicksendResponse = await fetch('https://rest.clicksend.com/v3/mms/send', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('normal.emma.brown@gmail.com:AD438B1C-C8E5-5B90-8703-2DFA3761D8F1').toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          media_file: mediaUrl,
          messages: [{
            source: "sketch-pad",
            subject: "Check out my drawing!",
            from: "SketchPad",
            body: smsMessage,
            to: phoneNumber,
            country: "US" // You might want to detect this dynamically
          }]
        })
    });

    // Check if the SMS request was successful
    if (!clicksendResponse.ok) {
      const errorText = await clicksendResponse.text();
      console.error('ClickSend API error:', clicksendResponse.status, errorText);
      return Response.json({ 
        error: `SMS failed: ${clicksendResponse.status} - ${errorText}` 
      }, { status: clicksendResponse.status });
    }

    const clicksendResult = await clicksendResponse.json();
    console.log('ClickSend response:', clicksendResult);

    // Check if ClickSend accepted the message
    if (clicksendResult.data && clicksendResult.data.messages) {
      const messageStatus = clicksendResult.data.messages[0];
      if (messageStatus.status === 'SUCCESS') {
        return Response.json({ 
          success: true, 
          message: 'SMS sent successfully',
          messageId: messageStatus.message_id,
          mediaUrl: mediaUrl
        });
      } else {
        return Response.json({ 
          error: `SMS failed: ${messageStatus.status} - ${messageStatus.error_text || 'Unknown error'}` 
        }, { status: 400 });
      }
    } else {
      return Response.json({ 
        error: 'Unexpected response format from ClickSend' 
      }, { status: 500 });
    }

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