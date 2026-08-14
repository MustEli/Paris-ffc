const button = document.getElementById('actionButton');
const message = document.getElementById('message');
const greeting = document.getElementById('greeting');
const navItems = document.querySelectorAll('.nav-item');

const setGreeting = () => {
  const hour = new Date().getHours();
  const label = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  greeting.textContent = label;
};

button.addEventListener('click', () => {
  message.textContent = 'Dashboard opened. Your home is ready for the next step.';
});

navItems.forEach((item) => {
  item.addEventListener('click', () => {
    navItems.forEach((nav) => nav.classList.remove('active'));
    item.classList.add('active');
    message.textContent = `${item.textContent.trim()} selected.`;
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

setGreeting();
