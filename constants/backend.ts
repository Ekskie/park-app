import ngrokConfig from '../backend/ngrok_config.json';

// Normalise once so both app and backend references stay in sync.
export const BACKEND_BASE_URL = (ngrokConfig.ngrok_url || '').replace(/\/$/, '');

export const NGROK_CONFIG_LOCATION = 'backend/ngrok_config.json';
