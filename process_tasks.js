const fs = require('fs');
let content = fs.readFileSync('TASK_QUEUE.md', 'utf8');

const lines = content.split('\n');
let newLines = [];
let inTask = false;
let currentTaskLines = [];
let doneTasks = [];
let qwenTasks = [];
let claudeTasks = [];
let gptTasks = [];

let summaryStarted = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.match(/^## .*PODSUMOWANIE ZADA/)) {
    summaryStarted = true;
    continue;
  }
  if (summaryStarted) {
    if (line.trim() === '---') { // End of summary block perhaps? No, we just skip until EOF
        continue;
    }
    continue; 
  }

  if (line.match(/^## \d+\. /)) {
    if (inTask) {
      processTaskBlock(currentTaskLines);
    }
    inTask = true;
    currentTaskLines = [line];
  } else if (inTask && (line.match(/^## /) || line.trim() === '---')) {
    processTaskBlock(currentTaskLines);
    inTask = false;
    currentTaskLines = [];
    newLines.push(line);
  } else if (inTask) {
    currentTaskLines.push(line);
  } else {
    newLines.push(line);
  }
}
if (inTask) {
  processTaskBlock(currentTaskLines);
}

function processTaskBlock(lines) {
  let isDone = false;
  let titleMatch = lines[0].match(/^## \d+\.\s*(.*)/);
  let title = titleMatch ? titleMatch[1].trim() : lines[0];
  let blockText = lines.join('\n');
  
  if (blockText.includes('Status: `done`') || blockText.includes('Status: done')) {
    isDone = true;
  }
  
  if (isDone) {
    doneTasks.push(blockText);
  } else {
    let lowerTitle = title.toLowerCase();
    let isTestOrSimple = lowerTitle.includes('test') || lowerTitle.includes('css') || lowerTitle.includes('layout') || lowerTitle.includes('lint') || lowerTitle.includes('dostępność') || lowerTitle.includes('prost');
    let isHard = lowerTitle.includes('audio') || lowerTitle.includes('architektura') || lowerTitle.includes('voice') || lowerTitle.includes('speaker') || lowerTitle.includes('server-side') || lowerTitle.includes('rnnoise') || lowerTitle.includes('diar');
    
    let assignee = 'gpt'; // default medium
    if (isTestOrSimple) assignee = 'qwen';
    else if (isHard) assignee = 'claude';
    
    let foundWykonawca = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('Wykonawca:')) {
        lines[i] = 'Wykonawca: `' + assignee + '`';
        foundWykonawca = true;
      }
    }
    if (!foundWykonawca) {
      lines.splice(2, 0, 'Wykonawca: `' + assignee + '`');
    }
    
    if (assignee === 'qwen') qwenTasks.push(title);
    else if (assignee === 'claude') claudeTasks.push(title);
    else gptTasks.push(title);
    
    newLines.push(lines.join('\n'));
  }
}

newLines.push('');
newLines.push('## 📻 PODSUMOWANIE ZADAŃ WEDŁUG WYKONAWCY');
newLines.push('');
newLines.push('### 🤖 Qwen (Testy i proste zadania)');
qwenTasks.forEach(t => newLines.push('- ' + t));
newLines.push('');
newLines.push('### 🤖 GPT (Średnie zadania)');
gptTasks.forEach(t => newLines.push('- ' + t));
newLines.push('');
newLines.push('### 🤖 Claude (Trudne zadania, dźwięk, architektura)');
claudeTasks.forEach(t => newLines.push('- ' + t));
newLines.push('');

fs.writeFileSync('TASK_QUEUE.md', newLines.join('\n'), 'utf8');

if (doneTasks.length > 0) {
  let doneContent = '';
  if (fs.existsSync('TASK_DONE.md')) {
    doneContent = fs.readFileSync('TASK_DONE.md', 'utf8') + '\n\n';
  } else {
    doneContent = '# TASK_DONE\n\n';
  }
  doneContent += doneTasks.join('\n\n---\n\n');
  fs.writeFileSync('TASK_DONE.md', doneContent, 'utf8');
}
console.log('Processed! Moved ' + doneTasks.length + ' tasks to DONE.');
