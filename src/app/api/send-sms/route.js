import telnyx from 'telnyx';
import FormData from 'form-data';

const client = telnyx(process.env.TELYNXKEY);

export async function POST(request) {
  try {
    const { phoneNumber, message, imageData } = await request.json();

    let smsMessage = message || 'Check out my drawing!';
    let mediaUrl = null;
    if (imageData) {
        try {
            console.log('Image data received, length:', imageData.length);
            
            const formData = new FormData();
            formData.append("image", imageData, 'drawing.png');
            console.log('Raw imageData:', imageData.substring(0, 100) + '...');
            console.log('Base64 data length:', base64Data.length);
            console.log('FormData entries:');
            for (let [key, value] of formData.entries()) {
                console.log(key, typeof value, value.length || 'N/A');
            }
            const imgbbResponse = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBBKEY}`, {
                method: 'POST',
                body: formData
            });
            
            if (imgbbResponse.ok) {
                const imgbbResult = await imgbbResponse.json();
                mediaUrl = imgbbResult.data.url;
                console.log('Image uploaded to ImgBB:', mediaUrl);
            } else {
                const errorText = await imgbbResponse.text();
                console.error('ImgBB upload failed:', imgbbResponse.status, errorText);
            }
        } catch (error) {
            console.error('ImgBB upload error:', error);
        }
    }
/*
    const messageData = {
      from: process.env.TELYNXNUMBER,
      messaging_profile_id: process.env.PROFILEID,
      to: phoneNumber,
      text: smsMessage
    };
    
    // Only add MMS fields if we have a media URL
    if (mediaUrl) {
      messageData.type = 'MMS';
      messageData.media_urls = [mediaUrl];
    } else {
      messageData.type = 'SMS';
    }

    const messageResponse = await client.messages.create(messageData);
    console.log('Telnyx response:', messageResponse);
    */
    return Response.json({ 
      success: true, 
      message: 'SMS sent successfully',
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