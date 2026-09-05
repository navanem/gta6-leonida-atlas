declare module 'virtual:atlas-account' {
  import type { ComponentType } from 'react';
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Ambient virtual modules require this form for local types.
  const Extension: ComponentType<import('./extension').AccountExtensionProps>;
  export default Extension;
}
