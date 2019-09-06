# shouter
A programmable Icecast Source Client that streams MP3 music to an Icecast server.

Basically, you need to run 2 HTTP endpoints, configured via the `SHOUTER_GET_SONG_URL` and `SHOUTER_PUT_SONG_URL` environment variables.

- `SHOUTER_GET_SONG_URL` will be invoked using the `GET` method to fetch the next song to be played. It will be invoked in the background while current song is being played. It should return a JSON payload with these structure:

  ```js
  {
    "url": "<URL to a song file>.mp3",
    "streamTitle": "<Song name to display on listeners’ client>",
    "info": { /* Any extra metadata you might want to include */ }
  }
  ```

  The URL must point to an MP3 file, but it can have a different bitrate, as it will be transcoded to MP3 with bitrate specified in `SHOUTER_BITRATE`. This allows you to keep your source files at the highest quality (e.g. 320kbps) while streaming at a reduced bitrate to reduce the bandwidth.

- `SHOUTER_PUT_SONG_URL` will be invoked using the `PUT` method when the client actually start streaming this song to the listeners. It will receive a JSON payload which will be the same payload that have been returned by `SHOUTER_GET_SONG_URL`.

This allows me to write a custom song selection logic completely decoupled from the Icecast source client, and also allows me to update that logic without having to restart the source.

It is used in [Be-Music Surge](https://github.com/bemusic/bmsurge).

## Docker

This repository is automatically built and deployed to Docker Hub.

```sh
docker run -d --name=shouter --restart=always --env-file=shouter.env dtinth/shouter
```

```sh
# shouter.env
SHOUTER_HOST=<ip>
SHOUTER_PORT=<port>
SHOUTER_USER=<user>
SHOUTER_PASSWORD=<password>
SHOUTER_MOUNT=<mountpoint>
SHOUTER_NAME=<title>
SHOUTER_GENRE=<genre>
SHOUTER_BITRATE=<bitrate>
SHOUTER_GET_SONG_URL=https://...
SHOUTER_PUT_SONG_URL=https://...
```
