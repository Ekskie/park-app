declare module 'react-native-event-source' {
  interface EventSourceInitDict {
    headers?: Record<string, string>;
    withCredentials?: boolean;
  }

  interface EventSource {
    onmessage: ((event: { data: string }) => void) | null;
    onopen: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    addEventListener(
      type: string,
      listener: (event: { data: string }) => void
    ): void;
    close(): void;
  }

  export default class EventSource {
    constructor(url: string, eventSourceInitDict?: EventSourceInitDict);
    onmessage: ((event: { data: string }) => void) | null;
    onopen: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    addEventListener(
      type: string,
      listener: (event: { data: string }) => void
    ): void;
    close(): void;
  }
}
