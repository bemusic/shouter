const nodeshout = require('nodeshout')
const stream = require('stream')
const { logger } = require('tkt')
const log = logger('ShoutStream')

module.exports = class ShoutStream extends stream.Writable {
  constructor(shout) {
    super()
    this.shout = shout
  }
  _write(chunk, _encoding, done) {
    const returnCode = this.shout.send(chunk, chunk.length)
    if (returnCode !== nodeshout.ErrorTypes.SUCCESS) {
      return done(
        new Error(`ShoutStream error ${returnCode}: ${this.shout.getError()}`)
      )
    }
    const delay = this.shout.delay()
    log.debug('Waiting %s ms before sending next chunk', delay)
    setTimeout(() => done(), Math.max(0, delay))
  }
}
