const PROMPTS = {
  strategy: `你是一位资深企业战略信息设计师、PPT视觉总监和手绘信息图插画师。请根据“页面文字内容”，生成一张可直接作为企业级PPT单页使用的完整视觉稿。

画布严格采用16:9横向比例，画面铺满，不出现PPT软件界面、外框、水印或页码。使用白色或极浅暖白背景，四周保留安全边距。

视觉采用“企业战略白板手绘信息图”风格：专业数字手绘线稿、清晰轮廓、轻微马克笔质感。主色限定为黑、白、企业科技蓝、浅蓝，并仅用少量柔和金色强调成果。不要摄影、复杂3D、玻璃拟态、霓虹、暗色背景或高饱和多彩配色。

先理解内容的逻辑关系，再选择清晰的信息架构。主标题是第一视觉焦点，正文包含3至6个主要模块，并用匹配内容的图标、插画、箭头或分区辅助阅读。保持高信息密度与充分留白，不让箭头或图标压住文字。

所有正式文字使用简体中文，必须逐字准确呈现用户提供的标题、标签、数字和专有名词，不得改写、删减、虚构或生成乱码伪文字。文字清晰锐利，最多四级层级。

只输出最终完成的一张PPT页面图像，不输出解释、设计说明或多个页面。

━━━━━━━━━━━━━━━━━━
【页面文字内容】
━━━━━━━━━━━━━━━━━━
`,
  minimal: `你是一位企业级演示文稿视觉设计师。请将页面文字设计为一张完整、专业的16:9横向PPT页面图片。

采用现代极简商务风格：白色背景、深灰正文、蓝色重点与少量金色强调；使用清晰的网格、充足留白和简洁的信息图形。主标题必须是第一视觉焦点，根据内容逻辑组织3至6个模块。避免照片、复杂3D、霓虹、玻璃拟态、厚重阴影、装饰性伪文字、水印、页码和PPT软件外框。

所有用户提供的简体中文、数字、英文和专有名词必须准确呈现，不得改写或虚构。只输出一张最终PPT页面图像，不输出解释。

【页面文字内容】
`
};

const $ = (id) => document.getElementById(id);
const elements = {
  settingsToggle: $("settings-toggle"), settings: $("api-settings"), keyToggle: $("key-toggle"),
  apiKey: $("api-key"), apiUrl: $("api-url"), model: $("model"), size: $("size"), quality: $("quality"),
  preset: $("prompt-preset"), systemPrompt: $("system-prompt"), content: $("ppt-content"), count: $("char-count"),
  generate: $("generate"), download: $("download"), empty: $("empty-state"), loading: $("loading-state"),
  image: $("result-image"), error: $("error-message"), generationTime: $("generation-time")
};

let currentImageUrl = "";
let objectUrl = "";
const COOKIE_DAYS = 30;
const SAVED_SETTINGS = {
  "api-url": elements.apiUrl,
  "api-key": elements.apiKey,
  model: elements.model,
  size: elements.size,
  quality: elements.quality
};

function setCookie(name, value) {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Strict`;
}

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

function restoreSettings() {
  Object.entries(SAVED_SETTINGS).forEach(([name, element]) => {
    const value = getCookie(name);
    if (value) element.value = value;
    element.addEventListener("change", () => setCookie(name, element.value));
  });
}

function setPreset(name) {
  if (PROMPTS[name]) elements.systemPrompt.value = PROMPTS[name];
}

function updateCount() {
  elements.count.textContent = `${elements.content.value.length} 字符`;
}

function setLoading(isLoading) {
  elements.generate.disabled = isLoading;
  elements.generate.querySelector("span:last-child").textContent = isLoading ? "正在生成…" : "生成 PPT 图片";
  elements.loading.hidden = !isLoading;
  if (isLoading) {
    elements.empty.hidden = true;
    elements.image.hidden = true;
    elements.download.hidden = true;
    elements.error.hidden = true;
  }
}

function showError(message) {
  elements.error.textContent = message;
  elements.error.hidden = false;
  elements.empty.hidden = false;
}

function extractError(status, body) {
  const apiMessage = body?.error?.message || body?.message || (typeof body === "string" ? body : "");
  return `生成失败（HTTP ${status}）${apiMessage ? `\n${apiMessage}` : ""}`;
}

async function generateImage() {
  const apiKey = elements.apiKey.value.trim();
  const apiUrl = elements.apiUrl.value.trim();
  const content = elements.content.value.trim();
  const systemPrompt = elements.systemPrompt.value.trim();
  if (!apiKey || !apiUrl || !content || !systemPrompt) {
    elements.settings.hidden = false;
    elements.settingsToggle.setAttribute("aria-expanded", "true");
    showError("请完整填写 API 地址、API Key、系统提示词和页面文字内容。");
    return;
  }

  Object.entries(SAVED_SETTINGS).forEach(([name, element]) => setCookie(name, element.value));
  setLoading(true);
  elements.generationTime.hidden = true;
  const startedAt = performance.now();
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: elements.model.value.trim(),
        prompt: `${systemPrompt}\n${content}`,
        size: elements.size.value,
        quality: elements.quality.value
      })
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = raw; }
    if (!response.ok) throw new Error(extractError(response.status, result));

    const imageData = result?.data?.[0];
    if (imageData?.b64_json) {
      const binary = atob(imageData.b64_json);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
      currentImageUrl = objectUrl;
    } else if (imageData?.url) {
      currentImageUrl = imageData.url;
    } else {
      throw new Error("API 请求成功，但响应中没有 data[0].b64_json 或 data[0].url。");
    }

    elements.image.src = currentImageUrl;
    await elements.image.decode().catch(() => {});
    elements.image.hidden = false;
    elements.empty.hidden = true;
    elements.download.hidden = false;
    const elapsedSeconds = (performance.now() - startedAt) / 1000;
    elements.generationTime.textContent = `本次生成耗时：${elapsedSeconds.toFixed(1)} 秒`;
    elements.generationTime.hidden = false;
  } catch (error) {
    const corsHint = error instanceof TypeError ? "浏览器无法访问该 API。请确认 API 已启用 CORS，并允许 Authorization 与 Content-Type 请求头。" : error.message;
    showError(corsHint);
  } finally {
    setLoading(false);
  }
}

async function downloadImage() {
  try {
    const response = await fetch(currentImageUrl);
    if (!response.ok) throw new Error();
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-ppt-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.png`;
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(currentImageUrl, "_blank", "noopener,noreferrer");
  }
}

elements.settingsToggle.addEventListener("click", () => {
  const expanded = elements.settingsToggle.getAttribute("aria-expanded") === "true";
  elements.settingsToggle.setAttribute("aria-expanded", String(!expanded));
  elements.settings.hidden = expanded;
});
elements.keyToggle.addEventListener("click", () => {
  const reveal = elements.apiKey.type === "password";
  elements.apiKey.type = reveal ? "text" : "password";
  elements.keyToggle.textContent = reveal ? "隐藏" : "显示";
  elements.keyToggle.setAttribute("aria-label", reveal ? "隐藏 API Key" : "显示 API Key");
});
elements.preset.addEventListener("change", () => setPreset(elements.preset.value));
elements.systemPrompt.addEventListener("input", () => { elements.preset.value = "custom"; });
elements.content.addEventListener("input", updateCount);
elements.generate.addEventListener("click", generateImage);
elements.download.addEventListener("click", downloadImage);

setPreset("strategy");
restoreSettings();
updateCount();



