declare module '*.svg' {
  import * as React from 'react'

  const ReactComponent: React.FunctionComponent<
    React.SVGProps<SVGSVGElement> & { title?: string }
  >

  export default ReactComponent
}

declare global {
  interface Navigator {
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
}

export {}