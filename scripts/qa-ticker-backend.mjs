import http from 'node:http'
import { syncBuiltinESMExports } from 'node:module'
const create = http.createServer
let calls = []
http.createServer = function (listener) {
  return create((request, response) => {
    if (request.url === '/__qa/calls') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(calls)); calls = []; return
    }
    if (request.url !== '/health') calls.push(request.url)
    listener(request, response)
  })
}
syncBuiltinESMExports()
await import('./e2e-backend-stub.mjs')
