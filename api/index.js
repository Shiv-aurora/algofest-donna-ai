import { app } from '../server/app.mjs'

export default function handler(req, res) {
  return app(req, res)
}
