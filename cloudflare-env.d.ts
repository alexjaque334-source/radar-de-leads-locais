declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    GOOGLE_MAPS_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    TOMTOM_API_KEY?: string;
    SUPERADMIN_EMAIL?: string;
  }
}
