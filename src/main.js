let arcBookmarksHtml = "";
let currentLanguage = "en";
const downloadBtnContainer = document.querySelector("#downloadBtnContainer");

const translations = {
  en: {
    chooseFile: "Choose File 📁",
    download: "Download",
    processing: "Processing...",
    success: "✅ Processing successful: ",
    errorReadingFile: "⚠️ Error reading file: ",
    errorParsingJSON: "⚠️ Error parsing JSON string: ",
    exportArcBookmarks: "🔖 Export Arc Bookmarks",
    howToUse: "How to use?",
    step01: "1. Click `Choose File 📁`, it will open Finder",
    step02: "2. Press `⌘⇧G` in Finder to open `Go to the folder` dialog",
    step03:
      "3. Type `~/Library/Application Support/Arc/StorableSidebar.json` in Finder dialog",
    step04: "4. Press `Enter` to locate the bookmark file",
    step05:
      "5. Press `Enter` again to select the `StorableSidebar.json` file. Once done, you will receive an `arcBookmarks.html` file. This is a standard bookmark file that can be imported into browsers such as Chrome, Edge, Safari, Firefox, etc",
    troubleshot:
      "I only tested on macOS, if you are using Windows or Linux, you may need to find the bookmark file manually by input `arc://version` in the Arc address bar and find the bookmark data storage path by `Profile Path`",
    declaration: "All Bookmarks are handled locally in your browser",
    whichVersions: "Which versions have been verified? (Under MacOS)",
    warning: "⚠️ Warning",
  },
  zh: {
    chooseFile: "选择文件 📁",
    download: "下载",
    processing: "处理中...",
    success: "✅ 处理成功：",
    errorReadingFile: "⚠️ 读取文件错误：",
    errorParsingJSON: "⚠️ 解析 JSON 字符串错误：",
    exportArcBookmarks: "🔖 导出 Arc 书签",
    howToUse: "使用教程",
    step01: "1. 点击 `选择文件 📁`",
    step02: "2. 在 Finder 中按 `⌘⇧G` 打开 `前往文件夹` 对话框",
    step03:
      "3. 在 Finder 对话框中输入 `~/Library/Application Support/Arc/StorableSidebar.json`",
    step04: "4. 按 `Enter` 定位到书签文件",
    step05:
      "5. 再次按 `Enter` 选择 `StorableSidebar.json` 文件。完成后，您将收到一个 `arcBookmarks.html` 文件。这是一个标准的书签文件，可以导入到 Chrome、Edge、Safari、Firefox 等浏览器中",
    troubleshot:
      "我只在 macOS 上进行了测试，如果您使用的是 Windows 或 Linux，您可能需要手动查找书签文件，方法是在 Arc 地址栏中输入 `arc://version`，然后通过 `Profile Path` 找到书签数据存储路径",
    declaration: "所有的书签都在您的浏览器本地处理",
    whichVersions: "已验证的版本有哪些？(MacOS 下)",
    warning: "⚠️ 警告",
  },
};

const escapeHTML = (str) => {
    if (!str) return "";
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function loadLanguage(userLanguage) {
  const translation = translations[userLanguage] || translations.en;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = translation[key] || `[${key}]`;
  });
}

document
  .querySelector("#languageSelect")
  .addEventListener("change", function () {
    loadLanguage(this.value);
    currentLanguage = this.value;
    downloadBtnContainer.style.display = "none";
  });

const translate = (key) => (translations[currentLanguage] || translations.en)[key];

window.addEventListener("load", function () {
  loadLanguage("en");
});

const processItem = (id, items) => {
  const item = items.find((item) => item.id === id);
  if (!item) {
    return "";
  }

  if (item.childrenIds && item.childrenIds.length > 0) {
    const title = escapeHTML(item.title || "Folder");
    const childrenHtml = item.childrenIds
      .map((childId) => processItem(childId, items))
      .join("\n");
    return `<DT><H3>${title}</H3>\n<DL><p>\n${childrenHtml}\n</DL><p>`;
  }

  if (item.data?.tab) {
    const url = item.data.tab.savedURL ?? "#";
    const title = escapeHTML(item.data.tab.savedTitle || url);
    return `<DT><A HREF="${url}">${title}</A></DT>`;
  }
  
  if(item.title) {
    return `<DT><H3>${escapeHTML(item.title)}</H3>\n<DL><p></DL><p>`;
  }

  return "";
};

const findContainerWithItemsAndSpaces = (containers) => {
  return containers?.find((container) => container.items && container.spaces);
};

const convertToBookmarkFormat = (sidebar) => {
  const container = findContainerWithItemsAndSpaces(sidebar?.containers);
  if (!container) {
    console.error("No container found with items and spaces");
    return "";
  }

  const { topAppsContainerIDs, spaces, items } = container;

  const topAppsId = topAppsContainerIDs?.find((id) => typeof id === "string");
  let topAppsResult = "";
  if (topAppsId) {
      const topAppsItem = items.find(item => item.id === topAppsId);
      if (topAppsItem?.childrenIds?.length > 0) {
          const childrenHtml = topAppsItem.childrenIds.map(childId => processItem(childId, items)).join('\n');
          topAppsResult = `<DT><H3>Top Apps</H3>\n<DL><p>\n${childrenHtml}\n</DL><p>`;
      }
  }

  const pinnedBookmarksResult = spaces
    .filter((spaceItem) => spaceItem.containerIDs && spaceItem.title)
    .map((spaceItem) => {
      const pinnedIndex = spaceItem.containerIDs.indexOf("pinned");
      if(pinnedIndex === -1 || pinnedIndex >= spaceItem.containerIDs.length -1) {
          return "";
      }
      const pinnedContainerId = spaceItem.containerIDs[pinnedIndex + 1];
      const pinnedContent = processItem(pinnedContainerId, items);

      if (!pinnedContent) return "";
      
      return `<DT><H3>${escapeHTML(spaceItem.title)} - Space</H3><DL><p>${pinnedContent}</DL><p>`;
    })
    .join("");

  const allContent = topAppsResult + pinnedBookmarksResult;

  // *** FINAL BUG FIX ***
  // The entire collection of bookmarks must be nested inside a single top-level folder.
  // This creates the unified structure that browser importers expect.
  const finalHtml = `
    <DT><H3>Arc Bookmarks</H3>
    <DL><p>
        ${allContent}
    </DL><p>
  `;

  return `
    <!DOCTYPE NETSCAPE-Bookmark-file-1>
        <HTML>
        <META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
        <Title>Bookmarks</Title>
        <H1>Bookmarks</H1>
        <DL><p>
        ${finalHtml}
        </DL><p>
        </HTML>
    `;
};

const download = (filename, text) => {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

document.querySelector("#downloadBtn").addEventListener("click", function () {
  download("arcBookmarks.html", arcBookmarksHtml);
});

document.querySelector("#jsonFile").addEventListener("click", function () {
  downloadBtnContainer.style.display = "none";
});

document.querySelector("#jsonFile").addEventListener("change", function () {
  if (this.files.length === 0) {
    return;
  }

  const file = this.files[0];
  const uploadBtn = document.querySelector("#jsonFile");
  const uploadBtnLabel = document.querySelector('label[for="jsonFile"]');
  const statusElement = document.querySelector("#status");
  const downloadBtnAndDividerElement = document.querySelector(
    "#downloadBtnAndDivider"
  );
  downloadBtnAndDividerElement.style.display = "flex";

  uploadBtn.disabled = true;
  uploadBtnLabel.innerText = translate("processing");
  downloadBtnContainer.style.display = "none";

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const arcBookmarks = JSON.parse(this.result);
      arcBookmarksHtml = convertToBookmarkFormat(arcBookmarks.sidebar);
      downloadBtnContainer.style.display = "block";
      statusElement.innerText = translate("success") + " arcBookmarks.html";
    } catch (err) {
      console.error("Error parsing JSON string:", err);
      downloadBtnContainer.style.display = "block";
      downloadBtnAndDividerElement.style.display = "none";
      statusElement.innerText = translate("errorParsingJSON") + err.message;
    } finally {
      uploadBtn.disabled = false;
      uploadBtnLabel.innerText = translate("chooseFile");
      uploadBtn.value = ""; 
    }
  };

  reader.onerror = function () {
    console.error("Error reading file:", this.error);
    statusElement.innerText =
      translate("errorReadingFile") + this.error.message;
    uploadBtn.disabled = false;
    uploadBtnLabel.innerText = translate("chooseFile");
    downloadBtnContainer.style.display = "block";
    downloadBtnAndDividerElement.style.display = "none";
  };

  reader.readAsText(file);
});
