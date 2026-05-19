type ClarityCommand = (...args: unknown[]) => void;
type ClarityWindow = Window & {
  clarity?: ClarityCommand & { q?: unknown[][] };
};

function isConfiguredClarityId(value: unknown): value is string {
  const projectId = String(value || '').trim();
  return (
    projectId.length > 0 &&
    projectId !== 'TWOJ_CLARITY_PROJECT_ID' &&
    !projectId.includes('VITE_CLARITY')
  );
}

export function initClarity(
  projectId = import.meta.env.VITE_CLARITY_ID,
  win: ClarityWindow = window,
  doc: Document = document
) {
  if (!isConfiguredClarityId(projectId)) {
    return false;
  }

  if (typeof win.clarity === 'function') {
    return false;
  }

  const clarity: ClarityCommand & { q?: unknown[][] } = (...args: unknown[]) => {
    clarity.q = clarity.q || [];
    clarity.q.push(args);
  };
  win.clarity = clarity;

  const script = doc.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${projectId}`;

  const firstScript = doc.getElementsByTagName('script')[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    doc.head.appendChild(script);
  }

  return true;
}
