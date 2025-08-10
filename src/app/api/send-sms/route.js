import telnyx from 'telnyx';
import FormData from 'form-data';

const client = telnyx("KEY019895E9C363EDB791691EB5A851CBB6_WcjhgRlw4BBRbSpbqt4gPM");

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
    const messageData = {
        from: "+14704028171",
        messaging_profile_id: "40019895-65b5-45ea-8c44-2e0795f8de09",
        to: phoneNumber,
        text: message || 'Check out my drawing!',
        media_urls: [mediaUrl],
        type: 'MMS'
    };
    const messageResponse = await client.messages.create(messageData);
    console.log('Telnyx response:', messageResponse);
    return Response.json({ 
      success: true, 
      message: 'MMS sent successfully',
      messageId: messageResponse.data.id,
      mediaUrl: mediaUrl
    });
  
  } catch (error) {
    console.error('Telnyx API error:', error);
    
    if (error.response) {
      return Response.json({ 
        error: `SMS failed: ${error.response.status} - ${error.response.data?.errors?.[0]?.detail || 'Unknown error'}` 
      }, { status: error.response.status });
    } else {
      return Response.json({ 
        error: 'Failed to send SMS' 
      }, { status: 500 });
    }
  }
}