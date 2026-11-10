// PwaRegister is a Server Component that injects an inline script to register
// the service worker after the page loads. No hooks needed — the script runs
// only in the browser, so it cannot crash during server-side prerender.

export function PwaRegister() {
  const script = `
(function(){
  if(!('serviceWorker' in navigator))return;
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(function(){});
  },{once:true});
})();
  `.trim();

  return (
    <script
      // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional SW registration inline script
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
