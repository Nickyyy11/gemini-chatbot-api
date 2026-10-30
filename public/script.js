const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitButton = document.getElementById('send-button');
const quickPrompts = document.getElementById('quick-prompts');

const conversation = [];
let isProcessing = false;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await sendMessage(input.value);
});

input.addEventListener('input', () => {
  resizeInput();
  updateSendButton();
});

input.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    if (!submitButton.disabled) form.requestSubmit();
  }
});

quickPrompts.addEventListener('click', (event) => {
  const prompt = event.target.closest('.quick-prompt');
  if (prompt && !isProcessing) sendMessage(prompt.textContent);
});

async function sendMessage(text) {
  const userMessage = text.trim();
  if (!userMessage || isProcessing) return;

  isProcessing = true;
  updateSendButton();
  quickPrompts.hidden = true;

  appendMessage('user', userMessage);
  input.value = '';
  resizeInput();

  const thinkingMessage = appendTypingMessage();
  const requestConversation = [
    ...conversation,
    { role: 'user', text: userMessage },
  ];

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation: requestConversation }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data && typeof data.error === 'string'
        ? data.error
        : `HTTP ${response.status}`;
      throw new Error(detail);
    }

    if (!data || typeof data.result !== 'string' || !data.result.trim()) {
      showMessageText(thinkingMessage, 'Maaf, belum ada jawaban. Silakan coba kembali.');
      return;
    }

    thinkingMessage.removeAttribute('role');
    thinkingMessage.removeAttribute('aria-label');
    thinkingMessage.classList.remove('typing');
    thinkingMessage.classList.add('markdown');
    thinkingMessage.replaceChildren();
    renderMarkdown(data.result, thinkingMessage);
    conversation.push(
      { role: 'user', text: userMessage },
      { role: 'model', text: data.result },
    );
  } catch (error) {
    console.error('Failed to get response from server:', error);
    showMessageText(thinkingMessage, 'Maaf, terjadi kendala saat menghubungi asisten. Silakan coba kembali.');
  } finally {
    isProcessing = false;
    updateSendButton();
    input.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
}

function appendMessage(sender, text) {
  const row = document.createElement('div');
  row.classList.add('message-row', `${sender}-row`);

  if (sender === 'bot') row.appendChild(createBotAvatar());

  const message = document.createElement('div');
  message.classList.add('message', sender);
  message.textContent = text;
  row.appendChild(message);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return message;
}

function appendTypingMessage() {
  const row = document.createElement('div');
  row.classList.add('message-row', 'bot-row');
  row.appendChild(createBotAvatar());

  const message = document.createElement('div');
  message.classList.add('message', 'bot', 'typing');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-label', 'AI sedang mengetik');

  const label = document.createElement('span');
  label.textContent = 'Sedang mengetik';
  message.appendChild(label);

  const dots = document.createElement('span');
  dots.classList.add('typing-dots');
  dots.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 3; i += 1) {
    dots.appendChild(document.createElement('span'));
  }
  message.appendChild(dots);

  row.appendChild(message);
  chatBox.appendChild(row);
  chatBox.scrollTop = chatBox.scrollHeight;
  return message;
}

function createBotAvatar() {
  return document.querySelector('.bot-avatar').cloneNode(true);
}

function resizeInput() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
}

function updateSendButton() {
  submitButton.disabled = isProcessing || !input.value.trim();
}

function showMessageText(message, text) {
  message.removeAttribute('role');
  message.removeAttribute('aria-label');
  message.classList.remove('typing', 'markdown');
  message.textContent = text;
}

function renderMarkdown(markdown, container) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const codeFence = line.match(/^\s*```([\w-]*)\s*$/);
    if (codeFence) {
      index += 1;
      const codeLines = [];
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      const pre = document.createElement('pre');
      const code = document.createElement('code');
      if (codeFence[1]) code.classList.add(`language-${codeFence[1]}`);
      code.textContent = codeLines.join('\n');
      pre.appendChild(code);
      container.appendChild(pre);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(heading[2], element);
      container.appendChild(element);
      index += 1;
      continue;
    }

    if (/^\s*([-*_]\s*){3,}$/.test(line)) {
      container.appendChild(document.createElement('hr'));
      index += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s*>/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      const quote = document.createElement('blockquote');
      renderMarkdown(quoteLines.join('\n'), quote);
      container.appendChild(quote);
      continue;
    }

    const listMatch = line.match(/^\s*([-+*]|\d+[.)])\s+(.+)$/);
    if (listMatch) {
      const isOrdered = /^\d/.test(listMatch[1]);
      const list = document.createElement(isOrdered ? 'ol' : 'ul');
      const listPattern = isOrdered
        ? /^\s*\d+[.)]\s+(.+)$/
        : /^\s*[-+*]\s+(.+)$/;

      while (index < lines.length) {
        const itemMatch = lines[index].match(listPattern);
        if (!itemMatch) break;
        const item = document.createElement('li');
        appendInlineMarkdown(itemMatch[1], item);
        list.appendChild(item);
        index += 1;
      }
      container.appendChild(list);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*>/.test(lines[index]) &&
      !/^\s*([-+*]|\d+[.)])\s+/.test(lines[index]) &&
      !/^\s*([-*_]\s*){3,}$/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    const paragraph = document.createElement('p');
    paragraphLines.forEach((paragraphLine, lineIndex) => {
      if (lineIndex > 0) paragraph.appendChild(document.createElement('br'));
      appendInlineMarkdown(paragraphLine, paragraph);
    });
    container.appendChild(paragraph);
  }
}

function appendInlineMarkdown(text, container) {
  const pattern = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\n]+)\*|_([^_\n]+)_/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match[1]) {
      const code = document.createElement('code');
      code.textContent = match[1];
      container.appendChild(code);
    } else if (match[2]) {
      const link = document.createElement('a');
      link.href = match[3];
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      appendInlineMarkdown(match[2], link);
      container.appendChild(link);
    } else if (match[4] || match[5]) {
      const strong = document.createElement('strong');
      appendInlineMarkdown(match[4] || match[5], strong);
      container.appendChild(strong);
    } else {
      const emphasis = document.createElement('em');
      appendInlineMarkdown(match[6] || match[7], emphasis);
      container.appendChild(emphasis);
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    container.appendChild(document.createTextNode(text.slice(lastIndex)));
  }
}
