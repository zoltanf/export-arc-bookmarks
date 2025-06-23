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

// --- STAGE 1A: PARSE A SINGLE ITEM FROM THE JSON INTO A CLEAN NODE ---
function buildNode(itemId, allItems) {
    const item = allItems.get(itemId);
    if (!item) return null;

    const node = {};
    const hasChildren = item.childrenIds && item.childrenIds.length > 0;

    if (hasChildren) {
        node.type = 'folder';
        node.title = item.title || 'Folder';
        node.children = item.childrenIds
            .map(childId => buildNode(childId, allItems))
            .filter(Boolean); // Remove any null children
    } else if (item.data?.tab) {
        node.type = 'bookmark';
        node.url = item.data.tab.savedURL;
        node.title = item.data.tab.savedTitle || node.url; // Use URL as fallback title
    } else if (item.title) { // Handle folders that are empty
        node.type = 'folder';
        node.title = item.title;
        node.children = [];
    } else {
        return null; // Ignore items that are not folders or bookmarks
    }

    return node;
}

// --- STAGE 1B: RENDER A CLEAN NODE INTO HTML ---
function renderNodeToHtml(node) {
    const escapeHTML = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') : '';
    const title = escapeHTML(node.title);

    if (node.type === 'folder') {
        const childrenHtml = node.children.map(renderNodeToHtml).join('\n');
        return `<DT><H3>${title}</H3>\n<DL><p>\n${childrenHtml}\n</DL><p>`;
    }
    if (node.type === 'bookmark') {
        return `<DT><A HREF="${node.url ?? '#'}">${title}</A></DT>`;
    }
    return '';
}

// --- MAIN CONVERSION FUNCTION USING THE NEW 2-STAGE PROCESS ---
const convertToBookmarkFormat = (sidebar) => {
    const container = sidebar?.containers?.find(c => c.items && c.spaces);
    if (!container) {
        console.error("Could not find a valid container in the JSON file.");
        return "";
    }

    // Create a Map for efficient O(1) lookups instead of slow O(n) .find() calls
    const itemsMap = new Map(container.items.map(item => [item.id, item]));

    // This will be the single root of our clean bookmark tree.
    const rootNode = { type: 'folder', title: 'Arc Bookmarks', children: [] };

    // Process "Top Apps"
    const topAppsId = container.topAppsContainerIDs?.find(id => typeof id === 'string');
    if (topAppsId) {
        const topAppsNode = buildNode(topAppsId, itemsMap);
        if (topAppsNode && topAppsNode.children.length > 0) {
            topAppsNode.title = "Top Apps"; // Give it a proper name
            rootNode.children.push(topAppsNode);
        }
    }

    // Process each "Space"
    container.spaces.forEach(space => {
        if (!space.containerIDs || !space.title) return;

        const pinnedIndex = space.containerIDs.indexOf("pinned");
        if (pinnedIndex === -1 || pinnedIndex + 1 >= space.containerIDs.length) return;

        const pinnedContainerId = space.containerIDs[pinnedIndex + 1];
        const pinnedNode = buildNode(pinnedContainerId, itemsMap);
        
        if (pinnedNode && pinnedNode.children.length > 0) {
             const spaceNode = {
                type: 'folder',
                title: `${space.title} - Space`,
                children: [pinnedNode] // The "Pinned Bookmarks" folder goes inside the Space folder
            };
            rootNode.children.push(spaceNode);
        }
    });

    // Render the entire clean tree into the final HTML structure
    const finalHtml = renderNodeToHtml(rootNode);

    return `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<Title>Bookmarks</Title>
<H1>Bookmarks</H1>
${finalHtml}`;
};


// --- UI and file handling logic (unchanged) ---

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
