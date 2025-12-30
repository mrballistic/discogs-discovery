import '@testing-library/jest-dom'
import { TextEncoder as NodeTextEncoder, TextDecoder as NodeTextDecoder } from 'util'

// @ts-expect-error needed for node compatibility
global.TextEncoder = NodeTextEncoder
// @ts-expect-error needed for node compatibility
global.TextDecoder = NodeTextDecoder

import { Request, Response, Headers } from 'undici'

// @ts-expect-error needed for node compatibility
global.Request = Request
// @ts-expect-error needed for node compatibility
global.Response = Response
// @ts-expect-error needed for node compatibility
global.Headers = Headers
