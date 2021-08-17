# genesys-cloud-ratelimts
Information on how to prevent rate limits in an enterprise IVR

Genesys Cloud like many cloud APIs have [Rate Limits](https://developer.genesys.cloud/api/rest/v2/organization/limits). They are designed to safeguard Genesys' services from abusive and unexpected traffic patterns, encourage efficient use of billable resources, and protect customers from unexpected usage. Note that not all limits are exposed externally. New limits are normally introduced and published regularly with new features, but Genesys reserves the right to leave limits undocumented when appropriate.

When building out a application its up to the builder of the code to do best practices eg leverage the [Notification service](https://developer.genesys.cloud/api/rest/v2/notifications/notification_service) and subscribe to [Topics](https://developer.genesys.cloud/api/rest/v2/notifications/available_topics) to recieve events through a WSS instead of repeatedly doing a GET request on a API Endpoint.

This Example Guide and repo is to give some ideas on how cacheing can be used when triggering a [data action](https://help.mypurecloud.com/articles/about-the-data-actions-integrations/). The use case I will be going through will be when inside an [architect](https://help.mypurecloud.com/articles/about-architect/) 'call flow' you want to run a data action to call the internal Genesys Cloud API to 'GET' the EWT of a specifc queue before transfering it to the queue. While you can directly call this API endpoint if you run this data action more then 300 times in a minute you will get rate limited as per the documentation. While 300 per minute is fine for most small sites when dealing with enterprise call center loads this number can be exceeded.

There are a few ways to 'cache' this data, depending on your environement and the amount of data you want to cache. Another **GREAT** advantage of using cache is not just avoiding rate limts but also vast improvments in speed. Below are some of the way I have done this in the past:

* Genesys Architect DataTables ['Details here'](https://developer.genesys.cloud/blog/2021-02-03-Caching-in-flows/#design-and-implement-a-data-action-response-cache)
* AWS API Gateway
* Google Apigee
* Google Cloud Function (what we will cover in this project)

Many more options and vendors also offer API solutions that can do this. The internal Genesys Architect DataTables are good for small sets of data, but for larger enterprise examples personally I prefer to use an API solution as its easier to manage at scale.

# AWS API Gateway

This is a great option If your into Lambdas as well as have a AWS Services account above the free tier. Caching can be turned on inside the 'API Gateway'

![](/docs/images/api-gateway-cache-settings.png?raw=true)

# Google Apigee

Leveraging Google Apigee is another option and has other advantages being a dedicated API gateway

![](/docs/images/apigee_trace.png?raw=true)

# Google Cloud Function

In this example I will be using and going into detail on using a [Google Cloud Function](https://cloud.google.com/functions) these are also nativly supported inside Genesys Cloud an in Integration point. For details on how to set these up inside Genesys Cloud refer to [here](https://help.mypurecloud.com/articles/setup-for-google-cloud-functions/).

Cloud Functions are normally ran as either Node.js or Golang, in this case im using a Node.js project usign npm. Personaly I find it easiest to use a Google Repo to host the code as then you can point the Cloud Function directly to this location. Otherwise you can also 'zip' up the directory and import it into the function. Before we get this this stage we will need to create an OAuth2.0 for the project to use. Create a 'Clent Creds' OAuth type with the required roles. Copy the CLIENTID & CLIENTSECRET

![](/docs/images/oauth.png?raw=true)

Now build out the Cloud Function, select the region you want and ensure HTTPS is used as well as its recommended to also use authentication and not leave the trigger endpoint open. Ensure you then also create 'Variables' with the names:

    CLIENTID
    CLIENTSECRET
    REGION

For a details on [REGIONS](https://developer.genesys.cloud/api/rest/)

![](/docs/images/function-vars.png?raw=true)

For the code it is up to you If you either use a GCP Repo (personally I find this the best as i can push updates) or the ZIP upload. Ensure you have ran 'npm install' on each of the packages before putting into a ZIP or connecting to the repo. There are only 2x packages required for this solution.

    npm install sample-http
    npm install purecloud-platform-client-v2

Also ensure that the code start point is set to 'start' as this is what is set inside the index.js file

![](/docs/images/function-code.png)

Now you should be able to load and run the project as a Cloud Function. If you look at the code inside the index.js file you will see that the environment variables are being used for the OAuth and the cache setup. This API recieves a 'POST' request in the format of:

    {
        "queueId": "enter-queueId",
        "mediaType": "call"
    }

The default cache timer I have setup is 1 minute, If a request from the same 'queueId' is requested within 1 min the cache value will be used removing the need to send the request to Genesys Cloud. This means that speed is faster as well as the issue of 300 requests per min goes away as only 1 request is actually hitting the Genesys Cloud API gateway.

![](/docs/images/postman-trace.png)

The response you will get back in in the format of:

    {
        "ewt": -1,
        "exists": true,
        "ttl": "2021-08-16T02:08:47.881Z"
    }

In reality the cache its self has a parent object that is the queueId, this is how it can be used for multiply queues for the one API and each of them having their own cache ttl timer. For example:

    {
        "18407baa-0bef-4352-a59c-053223565e68": {
                                                    "ewt": -1,
                                                    "exists": true,
                                                    "ttl": "2021-08-16T02:08:47.81Z"
                                                },
        "18407baa-0bef-4352-a59c-053223566f79": {
                                                    "ewt": 5,
                                                    "exists": true,
                                                    "ttl": "2021-08-16T02:08:58.17Z"
                                                },
    }

These additional parent objects in the JSON are not exposed to the respose JSON to keep the API simple and easy to consume from the Genesys Cloud Data Action side. This same concept can be used for other API requests to the Genesys Cloud API endpoints or anyother API for that matter.

Now you have a robust secure API endpoint to call inside Architect to get the EWT of a queue in your solution for EVERY interaction without having to worry about rate limiting at enterprise scale of over 300 requests per second.