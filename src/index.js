const { logger, cli } = require('tkt')
const nodeshout = require('nodeshout')
const Block = require('block-stream2')
const ShoutStream = require('./ShoutStream')
const toStream = require('to-readable-stream')
const axios = require('axios')
const execa = require('execa')

const die = text => {
  console.error(text)
  process.exit(1)
}
const env = name =>
  process.env[name] || die('Required environment variables: ' + name)

const config = {
  host: env('SHOUTER_HOST'),
  port: +env('SHOUTER_PORT'),
  user: env('SHOUTER_USER'),
  password: env('SHOUTER_PASSWORD'),
  mount: env('SHOUTER_MOUNT'),
  name: env('SHOUTER_NAME'),
  genre: env('SHOUTER_GENRE'),
  bitrate: +env('SHOUTER_BITRATE') || die('Invalid bitrate'),
  getSongURL: env('SHOUTER_GET_SONG_URL'),
  putSongURL: env('SHOUTER_PUT_SONG_URL')
}

cli()
  .command('$0', 'Runs the app', {}, async () => {
    const log = logger('main')

    let nextSongPromise = getNextSong()
    nextSongPromise.catch(logError(log, 'Failed to get the next song'))
    log.info('Getting the first song to play...')
    log.info('First song: %s', (await nextSongPromise).streamTitle)

    nodeshout.init()
    log.info('Initialized Nodeshout')

    // Create a shout instance
    var shout = nodeshout.create()
    log.info('Created Nodeshout instance')

    // Configure it
    shout.setHost(config.host)
    shout.setPort(config.port)
    shout.setUser(config.user)
    shout.setPassword(config.password)
    shout.setMount(config.mount)
    shout.setName(config.name)
    shout.setGenre(config.genre)
    shout.setFormat(1) // 0=ogg, 1=mp3
    shout.setAudioInfo('bitrate', `${config.bitrate}`)
    shout.setAudioInfo('samplerate', '44100')
    shout.setAudioInfo('channels', '2')

    // Open a connection
    if (shout.open() !== nodeshout.ErrorTypes.SUCCESS) {
      throw new Error(`shout.open() error: ${shout.getError()}`)
    }
    log.info('Connected to server')

    for (;;) {
      let nextSong
      try {
        nextSong = await nextSongPromise
      } catch (err) {
        log.error(
          { err },
          'Failed to get the next song… This is probably end of this stream :('
        )
        continue
      } finally {
        nextSongPromise = getNextSong()
        nextSongPromise.catch(logError(log, 'Failed to get the next song'))
      }
      const streamTitle = nextSong.data.streamTitle
      log.info('Now playing "%s"', streamTitle)
      const metadata = nodeshout.createMetadata()
      metadata.add('song', streamTitle)
      var returnCode = shout.setMetadata(metadata)
      if (returnCode !== nodeshout.ErrorTypes.SUCCESS) {
        throw new Error(
          `shout.setMetadata() ${returnCode}: ${shout.getError()}`
        )
      }
      axios
        .put(config.putSongURL, nextSong.data)
        .then(r => {
          log.info('Updated next song')
        })
        .catch(wrapAxiosError('Cannot update the next song'))
        .catch(logError(log, 'Failed to update next song'))
      await new Promise((resolve, reject) => {
        const shoutStream = toStream(nextSong.buffer)
          .pipe(new Block({ size: 16384, zeroPadding: false }))
          .pipe(new ShoutStream(shout))
        shoutStream.on('finish', resolve)
        shoutStream.on('error', reject)
      })
    }
  })
  .parse()

async function getNextSong() {
  const log = logger('getNextSong')
  let err
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios
        .get(config.getSongURL)
        .catch(wrapAxiosError('Cannot get the next song’s URL'))
      log.info({ data: response.data }, 'Got response for next song request')
      const url = response.data.url
      const songResponse = await axios
        .get(url, { responseType: 'stream' })
        .catch(wrapAxiosError('Cannot get the next song’s data'))
      const soxResult = await execa(
        'sox',
        [
          ...['--type', 'mp3'],
          '-',
          ...['--channels', '2'],
          ...['--rate', '44100'],
          ...['--type', 'mp3'],
          ...['--compression', '128'],
          '-'
        ],
        { stderr: 'inherit', encoding: null, input: songResponse.data }
      )
      log.info({ size: soxResult.stdout.length }, 'Converted audio')
      return {
        data: response.data,
        buffer: soxResult.stdout
      }
    } catch (e) {
      err = e
      log.error({ err }, 'Failed to get the next song, retrying')
    }
  }
  throw e
}

function logError(log, message) {
  return err => log.error({ err }, message)
}

function wrapAxiosError(message) {
  return e => {
    throw new Error(`${message}: ${e}`)
  }
}
