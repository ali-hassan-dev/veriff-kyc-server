# Veriff KYC Server

This project is a server utilized for Veriff KYC (Know Your Customer) integration. It allows Veriff clients to easily access verification reports of their customers and upload them to SharePoint.

## Key Highlights:

```
1. Receive webhooks from Veriff about decisions and events of a session.
2. Fetch all the relevant data of the specific session from Veriff.
3. Upload that data (media files, JSON files) to SharePoint.
```

For more details about the project, feel free to contact me. Thank you.

## Configuration

Before running the server, make sure to configure the following environment variables in the .env file:

```
PORT: The port on which the server will run (default: 3000)
API_KEYS: JSON array containing API keys required for Veriff authentication. Each object should have "apiKey" and "sharedSecretKey" keys.
BASE_URL: Base URL for the Veriff API.
VERSION: Version number for Veriff API requests.
TENANT_ID: Tenant ID for authentication.
CLIENT_ID: Client ID for authentication.
CLIENT_SECRET: Client secret for authentication.
RESOURCE: Resource for authentication.
SITE_DOMAIN: Domain of the SharePoint site where data will be uploaded.
SUBSITE: Subsite within the SharePoint site.
```

## Usage

```
1. Clone this repo
2. Navigate to the project directory: `cd veriff-kyc-server`
3. Install the dependencies: `npm install`
4. Copy the contents of ".env.example" to a new file named ".env" in the root directory: `cp .env.example .env`
5. Add all the configurations in the ".env" file
6. Build the project: `npm run build
7. Run the development server: `npm run dev`
```
