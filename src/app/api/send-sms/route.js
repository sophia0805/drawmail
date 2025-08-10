import FormData from 'form-data';

export async function POST(request) {
  try {
    const { phoneNumber, message, imageData } = await request.json();
    let mediaUrl = null;
    
    if (imageData) {
        try {
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const params = new URLSearchParams();
            params.append('image', base64Data);
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBBKEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params
            });

            const imgbbResult = await imgbbResponse.json();
            mediaUrl = imgbbResult.data.url;
            console.log('Image uploaded to ImgBB:', mediaUrl);
        } catch (error) {
            console.error('ImgBB upload error:', error);
        }
    }

    console.log(phoneNumber.replace(/^\+/, ''), message, mediaUrl)

    const messageData = {
        message_type: "text",
        text: message || 'Check out my drawing!',
        to: phoneNumber.replace(/^\+/, ''),
        from: "13234081270",
        channel: "mms",
        "image": {
            "url": mediaUrl,
            "caption": "drawing"
        }
    };

    const vonageResponse = await fetch('https://api.nexmo.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${process.env.VONAGE_API_KEY}:${process.env.VONAGE_API_SECRET}`).toString('base64')}`
        },
        body: JSON.stringify(messageData)
    });

    if (!vonageResponse.ok) {
        const errorData = await vonageResponse.json();
        console.error('Vonage API error:', errorData);
        return Response.json({ 
            error: `Message failed: ${vonageResponse.status} - ${errorData?.error?.detail || 'Unknown error'}` 
        }, { status: vonageResponse.status });
    }

    const vonageResult = await vonageResponse.json();
    console.log('Vonage response:', vonageResult);
    
    return Response.json({ 
      success: true, 
      message: mediaUrl ? 'MMS sent successfully' : 'SMS sent successfully',
      messageId: vonageResult.message_uuid,
      mediaUrl: mediaUrl
    });
  
  } catch (error) {
    console.error('Vonage API error:', error);
    return Response.json({ 
      error: 'Failed to send message' 
    }, { status: 500 });
  }
}