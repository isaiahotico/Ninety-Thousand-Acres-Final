const videos = [
  { id:1, title:'The most beautiful places you need to see', channel:'Wander Studio', category:'Travel', views:'1.2M views', time:'2 days ago', duration:'12:48', color:'#0ea5e9', image:'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=80' },
  { id:2, title:'Build a modern website from scratch', channel:'Code Daily', category:'Technology', views:'482K views', time:'5 hours ago', duration:'24:16', color:'#8b5cf6', image:'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=900&q=80' },
  { id:3, title:'Lo-fi beats to relax and focus', channel:'Chill Room', category:'Music', views:'3.8M views', time:'1 month ago', duration:'1:02:20', color:'#ec4899', image:'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=900&q=80' },
  { id:4, title:'Can I win with this unusual gaming setup?', channel:'Pixel Quest', category:'Gaming', views:'927K views', time:'3 days ago', duration:'18:05', color:'#22c55e', image:'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=900&q=80' },
  { id:5, title:'Easy recipes for busy weeknights', channel:'Kitchen Stories', category:'Cooking', views:'756K views', time:'1 week ago', duration:'10:32', color:'#f97316', image:'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80' },
  { id:6, title:'How to improve your productivity', channel:'Better Every Day', category:'Education', views:'214K views', time:'6 days ago', duration:'09:44', color:'#eab308', image:'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=900&q=80' },
  { id:7, title:'A cinematic walk through the city', channel:'Frame By Frame', category:'Film', views:'89K views', time:'4 days ago', duration:'07:18', color:'#14b8a6', image:'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=900&q=80' },
  { id:8, title:'Beginner workout you can do anywhere', channel:'Move More', category:'Fitness', views:'642K views', time:'2 weeks ago', duration:'15:20', color:'#ef4444', image:'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80' }
];

const categories = ['All','Music','Gaming','Technology','Travel','Cooking','Education','Fitness'];
let activeCategory = 'All';
let currentVideos = [...videos];

const $ = selector => document.querySelector(selector);
const grid = $('#videoGrid');
const title = $('#pageTitle');

function initials(name) {
  return name.split(' ').map(word => word[0]).join('').slice(0,2).toUpperCase();
}

function renderChips() {
  $('#chips').innerHTML = categories.map(category =>
    `<button class="chip ${category === activeCategory ? 'active' : ''}" data-chip="${category}">${category}</button>`
  ).join('');
}

function renderVideos(list = currentVideos) {
  currentVideos = list;
  if (!list.length) {
    grid.innerHTML = '<div class="empty">No videos found. Try another search or category.</div>';
    return;
  }
  grid.innerHTML = list.map(video => `
    <article class="video-card" data-id="${video.id}">
      <div class="thumb"><img src="${video.image}" alt="${video.title}" loading="lazy"><span class="duration">${video.duration}</span></div>
      <div class="video-info">
        <div class="channel-avatar" style="background:${video.color}">${initials(video.channel)}</div>
        <div><p class="video-title">${video.title}</p><div class="meta">${video.channel}<br>${video.views} • ${video.time}</div></div>
      </div>
    </article>`).join('');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function filterVideos(query = '') {
  const text = query.toLowerCase().trim();
  const result = videos.filter(video => {
    const categoryMatch = activeCategory === 'All' || video.category === activeCategory;
    const searchMatch = !text || `${video.title} ${video.channel} ${video.category}`.toLowerCase().includes(text);
    return categoryMatch && searchMatch;
  });
  title.textContent = text ? `Search results for “${query}”` : activeCategory === 'All' ? 'Recommended for you' : activeCategory;
  renderVideos(result);
}

$('#chips').addEventListener('click', event => {
  const chip = event.target.closest('[data-chip]');
  if (!chip) return;
  activeCategory = chip.dataset.chip;
  renderChips();
  filterVideos($('#searchInput').value);
});

$('#searchForm').addEventListener('submit', event => {
  event.preventDefault();
  filterVideos($('#searchInput').value);
});

$('#searchInput').addEventListener('input', event => filterVideos(event.target.value));

$('#videoGrid').addEventListener('click', event => {
  const card = event.target.closest('.video-card');
  if (!card) return;
  const video = videos.find(item => item.id === Number(card.dataset.id));
  showToast(`Playing “${video.title}”`);
  card.querySelector('.thumb').style.outline = '3px solid var(--accent)';
  setTimeout(() => card.querySelector('.thumb')?.style.removeProperty('outline'), 900);
});

$('#refreshBtn').addEventListener('click', () => {
  renderVideos([...currentVideos].sort(() => Math.random() - .5));
  showToast('Feed refreshed');
});

$('#sidebar').addEventListener('click', event => {
  const item = event.target.closest('.nav-item');
  if (!item) return;
  document.querySelectorAll('.nav-item').forEach(button => button.classList.remove('active'));
  item.classList.add('active');
  if (item.dataset.category) {
    activeCategory = item.dataset.category;
    renderChips();
    filterVideos($('#searchInput').value);
  } else {
    title.textContent = item.dataset.page;
    if (item.dataset.page === 'Trending') renderVideos([...videos].reverse());
    else if (item.dataset.page === 'Subscriptions') renderVideos(videos.slice(0,4));
    else renderVideos(videos);
  }
});

$('#uploadBtn').addEventListener('click', () => $('#uploadModal').classList.add('show'));
$('#closeModal').addEventListener('click', () => $('#uploadModal').classList.remove('show'));
$('#uploadModal').addEventListener('click', event => {
  if (event.target.id === 'uploadModal') event.currentTarget.classList.remove('show');
});

$('#uploadForm').addEventListener('submit', event => {
  event.preventDefault();
  const newVideo = {
    id: Date.now(), title: $('#videoTitle').value, channel:'Your Channel', category:'New', views:'0 views', time:'just now', duration:'00:00', color:'#ff3158', image: $('#videoUrl').value
  };
  videos.unshift(newVideo);
  $('#uploadForm').reset();
  $('#uploadModal').classList.remove('show');
  activeCategory = 'All'; renderChips(); filterVideos('');
  showToast('Your video was published');
});

$('#themeBtn').addEventListener('click', () => {
  document.body.classList.toggle('light');
  const light = document.body.classList.contains('light');
  document.documentElement.style.setProperty('--bg', light ? '#f7f7f7' : '#0f0f0f');
  document.documentElement.style.setProperty('--panel', light ? '#ffffff' : '#181818');
  document.documentElement.style.setProperty('--panel2', light ? '#e8e8e8' : '#272727');
  document.documentElement.style.setProperty('--text', light ? '#111' : '#f5f5f5');
  document.documentElement.style.setProperty('--muted', light ? '#666' : '#aaa');
  document.documentElement.style.setProperty('--border', light ? '#ddd' : '#303030');
});

$('#menuBtn').addEventListener('click', () => {
  const sidebar = $('#sidebar');
  sidebar.style.display = sidebar.style.display === 'none' ? '' : 'none';
  document.querySelector('main').style.marginLeft = sidebar.style.display === 'none' ? '0' : '';
  document.querySelector('main').style.width = sidebar.style.display === 'none' ? '100%' : '';
});

renderChips();
renderVideos();