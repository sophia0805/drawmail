import sharp from 'sharp';

export async function POST(request) {
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
        const convertResponse = await fetch('https://rest.clicksend.com/v3/uploads?convert=mms', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${process.env.CLICKSEND_USERNAME}:${process.env.CLICKSEND_API_KEY}`).toString('base64')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file: imageBuffer.toString('base64'),
                filename: 'drawing.jpg'
            })
        });
        
        if (convertResponse.ok) {
            const convertResult = await convertResponse.json();
            mediaUrl = convertResult.data.url;
            console.log('Image uploaded to ClickSend:', mediaUrl);
        } else {
            console.error('ClickSend upload failed:', convertResponse.status);
            return Response.json({ error: 'Image upload failed' }, { status: 400 });
        }
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
    }
}