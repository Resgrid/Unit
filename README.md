<div align='center'>

<h1>Resgrid Unit Application</h1>
<p>Resgrid Unit is a tablet and desktop optimized application for use in Appratuses, Vehicles in Teams or Squads</p>

<img src=https://github.com/Resgrid/Unit/blob/8616cdd54ce7e8ccba401053be3fa335ea638d76/imgs/UnitMainScreen.png?raw=true alt="logo" width= height= />

<h4> <a href=h>View Demo</a> <span> · </span> <a href="https://github.com/Resgrid/Unit/blob/master/README.md"> Documentation </a> <span> · </span> <a href="https://github.com/Resgrid/Unit/issues"> Report Bug </a> <span> · </span> <a href="https://github.com/Resgrid/Unit/issues"> Request Feature </a> </h4>


</div>

# :notebook_with_decorative_cover: Table of Contents

- [About the Project](#star2-about-the-project)
- [Roadmap](#compass-roadmap)
- [FAQ](#grey_question-faq)
- [License](#warning-license)


## :star2: About the Project

### :camera: Screenshots
<div align="center"> <a href="h"><img src="https://github.com/Resgrid/Unit/blob/8616cdd54ce7e8ccba401053be3fa335ea638d76/imgs/UnitCallsList.png?raw=true" alt='image' width='800'/></a> </div>
<div align="center"> <a href="h"><img src="https://github.com/Resgrid/Unit/blob/8616cdd54ce7e8ccba401053be3fa335ea638d76/imgs/UnitViewCall.png?raw=true" alt='image' width='800'/></a> </div>
<div align="center"> <a href="h"><img src="https://github.com/Resgrid/Unit/blob/8616cdd54ce7e8ccba401053be3fa335ea638d76/imgs/UnitPTT.png?raw=true" alt='image' width='800'/></a> </div>



### :dart: Features
- Tablet and Laptop Optimized
- Realtime Geolocation
- Automatic Vehicle Location (AVL)


### :key: Environment Variables
To run this project, you will need to add the following environment variables to your .env file
`baseApiUrl`

`resgridApiUrl`

`channelUrl`

`channelHubName`

`realtimeGeolocationHubName`

`logLevel`

`what3WordsKey`

`isDemo`

`demoToken`

`osmMapKey`

`mapTilerKey`

`googleMapsKey`

`loggingKey`

`appKey`



## :toolbox: Getting Started

### :gear: Installation

Install Deps
```bash
npm ci
```
Build App
```bash
npm run build
```
Start Local Sim
```bash
npm run start
```
To copy web assets to native projects
```bash
npx cap sync
```


### :running: Run Locally

Clone the project

```bash
https://github.com/Resgrid/Unit
```
Go to project directory
```bash
cd Unit
```
Install dependencies
```bash
npm ci
```
Start the web server
```bash
npm run start
```


## :compass: Roadmap

* [x] Open Source Unit App
* [ ] Native Mapbox Map with Directions
* [ ] Offline Capibilities


## :grey_question: FAQ

- Can I deploy the Unit App to Google Play or the Apple App Store
- You can but you cannot inclue "Resgrid" in the name of your application in the name of the application or the store listing.
- What Do I need to Change to Deploy the Unit App to the stores
- You will need to search for all occurances of "com.resgrid.unit" and replace it with your app id. You will need to replace the icons, logos, splash screen images with your own.


## :warning: License

Distributed under the no License. See LICENSE.txt for more information.