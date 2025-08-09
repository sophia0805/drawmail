import { createServer } from 'http';
import { spawn } from 'child_process';
import sharp from 'sharp';

function startFileServer(imageBuffer, port = 3001) {
    return new Promise((resolve, reject) => {
        const server = createServer((req, res) => {
            if (req.url === '/image.jpg') {
                res.writeHead(200, {
                'Content-Type': 'image/jpeg',
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
        
        const checkInterval = setInterval(() => {
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
        let smsMessage = message || 'Check out my drawing!';
        let mediaUrl = null;
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        let imageBuffer = Buffer.from(base64Data, 'base64');

        try {
            imageBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 100 })
            .toBuffer();
            console.log('Image converted to JPEG');
        } catch (conversionError) {
            console.error('Image conversion failed:', conversionError);
            return Response.json({ error: 'Image conversion failed' }, { status: 400 });
        }
            
        tempServer = await startFileServer(imageBuffer, 3001);
        console.log('Temp server started on port 3001');
        const { ngrok, publicUrl: ngrokUrl } = await startNgrok(3001);
        ngrokProcess = ngrok;

        console.log('ngrok URL:', ngrokUrl, "\tFull image URL:", `${ngrokUrl}/image.jpg`);
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        const cdnResponse = await fetch('https://cdn.hackclub.com/api/v3/new', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer beans',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([`${ngrokUrl}/image.jpg`])
        });

        const cdnResult = await cdnResponse.json();
        mediaUrl = cdnResult.files[0].deployedUrl;
        const clicksendResponse = await fetch('https://rest.clicksend.com/v3/mms/send', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`).toString('base64')}`,
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
            country: "US"
            }]
        })
        });

        const clicksendResult = await clicksendResponse.json();
        const messageStatus = clicksendResult.data.messages[0];
        if (messageStatus.status === 'SUCCESS') {
            return Response.json({ 
                success: true, 
                message: 'Message sent successfully!',
                messageId: messageStatus.message_id,
                cdnUrl: cdnResult.files[0].deployedUrl,
                mmsUrl: mediaUrl
            });
        } else {
            return Response.json({ 
                error: `MMS failed: ${messageStatus.status} - ${messageStatus.error_text || 'Unknown error'}` 
            }, { status: 400 });
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