/**
* Created by Matt McPhee as a example for rate limiting protection with cache
* 
* @param {!express:Request} req HTTP request context.
* @param {!express:Response} res HTTP response context.
*/

const clientId = process.env.CLIENTID           //OAuth2
const clientSecret = process.env.CLIENTSECRET   //OAuth2
const region = process.env.REGION               //eg: mypurecloud.com.au

const platformClient = require('purecloud-platform-client-v2')
const client = platformClient.ApiClient.instance
const rapi = new platformClient.RoutingApi()

client.setEnvironment(region)
//client.setPersistSettings(true, '_mm_')

console.log('Logging in to Genesys Cloud')
if (!clientId) { console.log('Missing CLIENTID'); process.exit() }
if (!clientSecret) { console.log('Missing CLIENTSECRET'); process.exit() }
if (!region) { console.log('Missing REGION'); process.exit() }
client.loginClientCredentialsGrant(clientId, clientSecret)

// We declare a global variable to store cached data
const cache = {
  data: {}
}

exports.start = async (req, res) => {
  let queueId = req.body.queueId
  let mediaType = req.body.mediaType

  // We check if our data was fetched more than a min ago. It not we return the cached data
  if (cache.data[queueId]?.exists && cache.data[queueId]?.ttl > new Date()) {
    console.log('Inside cache')
    console.log(cache.data)
    return res.status(200).send(cache.data[queueId])
  }

  // Fetch statistics from Genesys
  console.log('GET Genesys Data');
  console.log(`queueId: ${queueId}`)
  console.log(`mediaType: ${mediaType}`)

  try {

    const data = await rapi.getRoutingQueueMediatypeEstimatedwaittime(queueId, mediaType)
    var response = {}
    response[queueId] = { ewt: 0, exists: true, ttl: new Date() }
    response[queueId].ewt = data.results[0].estimatedWaitTimeSeconds

    // Store fresh data in cache
    cache.data = response
    // Store a TTL for the data
    const dateInOneMin = new Date()
    dateInOneMin.setMinutes(dateInOneMin.getMinutes() + 1);
    cache.data[queueId].ttl = dateInOneMin
    console.log(response)

    res.status(200).send(response[queueId])

  } catch (err) {
    console.log(err)
    res.status(err.status).send({ error: err })
  }
};