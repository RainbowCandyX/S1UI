use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum S1Error {
    #[error("未登录")]
    NotAuthenticated,

    #[error("网络请求失败: {0}")]
    Http(#[from] reqwest::Error),

    #[error("URL 解析失败: {0}")]
    Url(#[from] url::ParseError),

    #[error("服务器返回 {status}: {body}")]
    Api { status: u16, body: String },

    #[error("序列化失败: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("{0}")]
    Other(String),
}

// Tauri command 的错误必须可 Serialize。最简单：统一转成字符串。
impl Serialize for S1Error {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type S1Result<T> = Result<T, S1Error>;
