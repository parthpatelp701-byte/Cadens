// Keep existing bookmarks and recovery/OAuth links on the single auth surface.
const params = new URLSearchParams(location.search)
const callback = params.has('code') || params.has('error') || params.has('recovery') || /(?:access_token|refresh_token|error)=/.test(location.hash)
const destination = callback ? '/' : location.hash === '#signup' ? '/signup' : location.hash === '#reset' ? '/reset' : '/signin'
location.replace(destination + (callback ? location.search + location.hash : ''))
