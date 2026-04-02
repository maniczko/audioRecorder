import fs from 'fs';
import path from 'path';

const maps = {
  'TasksTab.jsx': 'tasks.css',
  'RecordingsTab.jsx': 'recordings.css',
  'ProfileTab.jsx': 'profile.css',
  'AuthScreen.jsx': 'auth.css',
  'CalendarTab.jsx': 'calendar.css',
  'PeopleTab.jsx': 'people.css',
};

for (const [file, css] of Object.entries(maps)) {
  const p = path.join('src', file);
  if (fs.existsSync(p)) {
    let src = fs.readFileSync(p, 'utf8');
    const imp = `import './styles/${css}';\n`;
    if (!src.includes(`import './styles/${css}'`)) {
      src = imp + src;
      fs.writeFileSync(p, src);
      console.log('Added ' + css + ' to ' + file);
    }
  }
}
