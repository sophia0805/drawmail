- https://hackatime-badge.hackclub.com/U074B2Y4ANL/desmos-artist | ![](https://hackatime-badge.hackclub.com/U074B2Y4ANL/desmos-artist)  
i swear i'm gonna stop renaming my folders accidentally now

# drawmail  | [![Athena Award Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Faward.athena.hackclub.com%2Fapi%2Fbadge)](https://award.athena.hackclub.com?utm_source=readme)

send your beautiful drawing to any phone number of your choice, along with a customized message or just download and keep it for yourself!
> inspired by a desire to prank my friends with fun drawings

## features
- sketchpad where you can draw with any color and any size brush
- phone number and message inputs
- sms/mms api to send the images/msgs
- download feature to save your precious images

## usage
1. draw a fun picture
2. type in a phone number and message
3. click send or download it for yourself
4. wait for your friends to see!

## installation  
- there are two versions, this one uses imgbb to upload the image and vonage to send the message, but you can also check out the other one [here](https://github.com/sophia0805/sturdy-waffle/tree/cdn-clicksend)
1. **Clone the repository**
   ```bash
   git clone https://github.com/sophia0805/drawmail
   cd drawmail
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a .env**
    ```.env
    IMGBBKEY=""
    VONAGE_API_KEY=""
    VONAGE_API_SECRET=""
    VONAGE_FROM_NUMBER=""
    ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## history
- okay so originally i tried to use twilio, which didn't work very well because they could only send to verified numbers and i wanted to prank my friends
- then, i switched to clicksend, which kept disabling my accounts because i wasn't a business, but also only took png URLs when i had the raw data
- this lead me to attempt to use hack club cdn's api, which required ngrok, so i set it all up with clicksend and it worked!! unfortunately, i couldn't figure out a way to deploy the ngrok local server with vercel, so i changed the entire idea
- i gave up with clicksend, switching instead to telynx which had the same issue as twilio, despite having better pricing
- while attempting to use telynx, i figured out a way to use imgbb as an image uploader instead of cdn, so i could host it on vercel
- finally, i switched to vonage, which despite a $2 trial limit, works well so far yay

### finished project:
![](https://hc-cdn.hel1.your-objectstorage.com/s/v3/327dd817897d301a541fce4386a6839b010f5b69_image.png) 