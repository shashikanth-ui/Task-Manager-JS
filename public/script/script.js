  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 60;

  // Track mouse position
  let mouse = { x: null, y: null };
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5
    });
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    particles.forEach(p => {
      // Particle reaction to mouse
      if (mouse.x && mouse.y) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) { // hover distance threshold
          const angle = Math.atan2(dy, dx);
          const force = (100 - dist) / 20;
          p.vx += Math.cos(angle) * force * 0.05;
          p.vy += Math.sin(angle) * force * 0.05;
        }
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(33,33,33,0.6)';
      ctx.fill();

      // Move particle
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x > width) p.x = 0;
      if (p.x < 0) p.x = width;
      if (p.y > height) p.y = 0;
      if (p.y < 0) p.y = height;
    });

    // Draw lines between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(33,33,33,0.1)';
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    requestAnimationFrame(animate);
  }

  animate();

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });