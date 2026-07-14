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
const MODEL_CONFIGS = {
  "gpt-image-2": {
    label: "GPT Image 2",
    apiModel: "gpt-image-2-vip",
    parameters: [
      {
        name: "size",
        label: "图片尺寸",
        type: "select",
        default: "2048x1152",
        options: [
          { value: "2048x1152", label: "2048 × 1152 (16:9)" },
          { value: "1536x864", label: "1536 × 864 (16:9)" },
          { value: "1024x1024", label: "1024 × 1024 (1:1)" }
        ]
      },
      {
        name: "quality",
        label: "质量",
        type: "select",
        default: "high",
        options: [
          { value: "high", label: "高" },
          { value: "medium", label: "中" },
          { value: "low", label: "低" }
        ]
      },
      {
        name: "output_format",
        label: "输出格式",
        type: "select",
        default: "jpeg",
        options: [
          { value: "png", label: "PNG" },
          { value: "jpeg", label: "JPEG" },
          { value: "webp", label: "WebP" }
        ]
      },
      {
        name: "output_compression",
        label: "压缩质量",
        type: "range",
        valueType: "integer",
        min: 0,
        max: 100,
        step: 1,
        default: 50
      }
    ],
    buildPayload(prompt, values) {
      return { model: this.apiModel, prompt, ...values };
    },
    parseResponse(result) {
      const image = result?.data?.[0];
      if (image?.b64_json) return { kind: "base64", value: image.b64_json };
      if (image?.url) return { kind: "url", value: image.url };
      throw new Error("API 请求成功，但响应中没有 data[0].b64_json 或 data[0].url。");
    }
  }
};

const $ = (id) => document.getElementById(id);
const elements = {
  settingsToggle: $("settings-toggle"), settings: $("api-settings"), keyToggle: $("key-toggle"),
  apiKey: $("api-key"), apiUrl: $("api-url"), modelSelector: $("model-selector"),
  modelParameters: $("model-parameters"), preset: $("prompt-preset"), systemPrompt: $("system-prompt"),
  content: $("ppt-content"), count: $("char-count"), generate: $("generate"), download: $("download"),
  empty: $("empty-state"), loading: $("loading-state"), image: $("result-image"),
  error: $("error-message"), generationTime: $("generation-time")
};

const STORAGE_PREFIX = "ai-ppt-html.";
let currentImageUrl = "";
let objectUrl = "";
let parameterElements = {};

function setSetting(name, value) {
  localStorage.setItem(`${STORAGE_PREFIX}${name}`, value);
}

function getSetting(name) {
  return localStorage.getItem(`${STORAGE_PREFIX}${name}`) ?? "";
}

function modelSettingName(modelId, parameterName) {
  return `model.${modelId}.${parameterName}`;
}

function clearLegacyCookies() {
  const names = ["api-url", "api-key", "selected-model"];
  Object.entries(MODEL_CONFIGS).forEach(([modelId, config]) => {
    config.parameters.forEach(({ name }) => names.push(`model.${modelId}.${name}`));
  });
  names.forEach((name) => {
    document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; path=/; SameSite=Strict`;
  });
}

function createParameterControl(modelId, definition) {
  const label = document.createElement("label");
  label.className = "field";
  const title = document.createElement("span");
  title.textContent = definition.label;
  label.appendChild(title);

  let input;
  if (definition.type === "select") {
    input = document.createElement("select");
    definition.options.forEach((option) => input.add(new Option(option.label, option.value)));
    label.appendChild(input);
  } else if (definition.type === "range") {
    const wrapper = document.createElement("div");
    wrapper.className = "range-field";
    input = document.createElement("input");
    input.type = "range";
    input.min = definition.min;
    input.max = definition.max;
    input.step = definition.step;
    const output = document.createElement("output");
    output.className = "range-output";
    input.addEventListener("input", () => { output.value = input.value; });
    wrapper.append(input, output);
    label.appendChild(wrapper);
  } else {
    input = document.createElement("input");
    input.type = definition.type || "text";
    if (definition.min !== undefined) input.min = definition.min;
    if (definition.max !== undefined) input.max = definition.max;
    if (definition.step !== undefined) input.step = definition.step;
    label.appendChild(input);
  }

  input.id = `parameter-${definition.name}`;
  input.name = definition.name;
  input.required = definition.required !== false;
  const savedValue = getSetting(modelSettingName(modelId, definition.name));
  input.value = savedValue !== "" ? savedValue : definition.default;
  input.dispatchEvent(new Event("input"));
  input.addEventListener("change", () => setSetting(modelSettingName(modelId, definition.name), input.value));
  parameterElements[definition.name] = input;
  return label;
}

function renderModelParameters() {
  const modelId = elements.modelSelector.value;
  const config = MODEL_CONFIGS[modelId];
  elements.modelParameters.replaceChildren();
  parameterElements = {};
  config.parameters.forEach((definition) => {
    elements.modelParameters.appendChild(createParameterControl(modelId, definition));
  });
  setSetting("selected-model", modelId);
}

function initializeModels() {
  Object.entries(MODEL_CONFIGS).forEach(([id, config]) => {
    elements.modelSelector.add(new Option(config.label, id));
  });
  const savedModel = getSetting("selected-model");
  if (MODEL_CONFIGS[savedModel]) elements.modelSelector.value = savedModel;
  elements.modelSelector.addEventListener("change", renderModelParameters);
  renderModelParameters();
}

function readModelParameters(config) {
  return Object.fromEntries(config.parameters.map((definition) => {
    const input = parameterElements[definition.name];
    if (!input.checkValidity()) throw new Error(`${definition.label}参数无效。`);
    let value = input.value;
    if (definition.valueType === "integer") value = Number.parseInt(value, 10);
    if (definition.valueType === "number") value = Number(value);
    return [definition.name, value];
  }));
}

function persistSettings() {
  setSetting("api-url", elements.apiUrl.value);
  setSetting("api-key", elements.apiKey.value);
  setSetting("selected-model", elements.modelSelector.value);
  Object.entries(parameterElements).forEach(([name, input]) => {
    setSetting(modelSettingName(elements.modelSelector.value, name), input.value);
  });
}

function restoreCommonSettings() {
  const apiUrl = getSetting("api-url");
  const apiKey = getSetting("api-key");
  if (apiUrl) elements.apiUrl.value = apiUrl;
  if (apiKey) elements.apiKey.value = apiKey;
  elements.apiUrl.addEventListener("change", persistSettings);
  elements.apiKey.addEventListener("change", persistSettings);
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

function imageMimeType(format) {
  return format === "jpg" ? "image/jpeg" : `image/${format}`;
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

  const config = MODEL_CONFIGS[elements.modelSelector.value];
  let values;
  try {
    values = readModelParameters(config);
  } catch (error) {
    showError(error.message);
    return;
  }

  persistSettings();
  setLoading(true);
  elements.generationTime.hidden = true;
  const startedAt = performance.now();
  try {
    const payload = config.buildPayload(`${systemPrompt}\n${content}`, values);
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = raw; }
    if (!response.ok) throw new Error(extractError(response.status, result));

    const imageData = config.parseResponse(result);
    if (imageData.kind === "base64") {
      const binary = atob(imageData.value);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const format = values.output_format || "png";
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: imageMimeType(format) }));
      currentImageUrl = objectUrl;
    } else {
      currentImageUrl = imageData.value;
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
    const extension = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ai-ppt-${new Date().toISOString().slice(0, 19).replaceAll(":", "-")}.${extension}`;
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

clearLegacyCookies();
setPreset("strategy");
restoreCommonSettings();
initializeModels();
updateCount();

