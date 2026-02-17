document.addEventListener('DOMContentLoaded', () => {
    // --- 1. PRELOADER & INIT ---
    document.body.classList.remove('loading');

    // --- 2. CUSTOM CURSOR (Desktop Only) ---
    if (window.innerWidth > 768) {
        const cursorDot = document.querySelector('.cursor-dot');
        const cursorRing = document.querySelector('.cursor-ring');
        let mouseX = 0, mouseY = 0;
        let ringX = 0, ringY = 0;

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
            // Dot follows instantly
            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;
        });

        // Loop for smooth ring follow
        function loopCursor() {
            // Lerp: current = current + (target - current) * factor
            ringX += (mouseX - ringX) * 0.15;
            ringY += (mouseY - ringY) * 0.15;
            cursorRing.style.left = `${ringX}px`;
            cursorRing.style.top = `${ringY}px`;
            requestAnimationFrame(loopCursor);
        }
        loopCursor();

        // Hover Effects
        const interactiveElements = document.querySelectorAll('a, button, .bento-item, .card-3d');
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => cursorRing.classList.add('hovered'));
            el.addEventListener('mouseleave', () => cursorRing.classList.remove('hovered'));
        });
    }

    // --- 3. PARTICLE SYSTEM ---
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        // Random position
        p.style.left = `${Math.random() * 100}%`;
        // Random delay
        p.style.animationDelay = `${Math.random() * 10}s`;
        // Random duration
        p.style.animationDuration = `${10 + Math.random() * 5}s`;
        particlesContainer.appendChild(p);
    }

    // --- 3.5. 3D HERO INTERACTION ---
    const heroSection = document.getElementById('hero');
    const cube = document.querySelector('.cube');
    if (heroSection && cube) {
        heroSection.addEventListener('mousemove', (e) => {
            const x = e.clientX / window.innerWidth - 0.5;
            const y = e.clientY / window.innerHeight - 0.5;

            // Add mouse rotation to the base animation
            // We use CSS variable or direct transform. 
            // Since there's an animation loop, we might want to just offset it or use a wrapper.
            // Simplified approach: Just tilt the scene container slightly
            const scene = document.querySelector('.scene-3d');
            scene.style.transform = `translate(-50%, -50%) rotateY(${x * 30}deg) rotateX(${-y * 30}deg)`;
        });
    }

    // --- 4. NAVIGATION SCROLL EFFECT ---
    const nav = document.querySelector('.pill-nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        // Update Scroll Progress
        const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
        const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (winScroll / height);
        document.querySelector('.scroll-progress').style.transform = `scaleX(${scrolled})`;
    });

    // --- 5. HORIZONTAL SCROLL SECTION ---
    const roomsSection = document.getElementById('rooms');
    const roomsWrapper = document.querySelector('.rooms-track');

    // Only apply on Desktop
    if (window.innerWidth > 768) {
        window.addEventListener('scroll', () => {
            const rect = roomsSection.getBoundingClientRect();
            // Check if section is in viewport
            if (rect.top <= 0 && rect.bottom >= window.innerHeight) {
                // Calculate progress based on how far we've scrolled into the section
                const totalHeight = roomsSection.offsetHeight - window.innerHeight;
                const scrolled = Math.abs(rect.top);
                const progress = scrolled / totalHeight;

                // Max horizontal transition
                const maxTranslate = roomsWrapper.scrollWidth - window.innerWidth;

                roomsWrapper.style.transform = `translateX(-${progress * maxTranslate}px)`;
            }
        });
    }

    // --- 6. 3D TILT EFFECT (Wellness) ---
    const cards = document.querySelectorAll('.card-3d');
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Calculate rotation (-20 to 20 deg)
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = ((y - centerY) / centerY) * -10; // Inverted for tilt
            const rotateY = ((x - centerX) / centerX) * 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
        });
    });

    // --- 7. INTERSECTION OBSERVER FOR ANIMATIONS ---
    const observerOptions = { threshold: 0.15 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                // Basic fade in reset
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Fade in elements
    const fadeElements = document.querySelectorAll('.card-3d, .bento-item, .contact-card-wrapper, .package-card, .split-content');
    fadeElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(50px)';
        el.style.transition = `opacity 0.8s ease ${index * 0.1}s, transform 0.8s ease ${index * 0.1}s`;
        observer.observe(el);
    });

    // Active Link highlighting
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - sectionHeight / 3)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('active');
            }
        });
    });


    // --- 8. MODAL & FORMS ---
    const modal = document.getElementById('bookingModal');
    const openBtn = document.getElementById('openBookingModal');
    const closeBtn = document.querySelector('.close-modal');

    // Check if elements exist (might clean up code slightly)
    if (openBtn) {
        openBtn.addEventListener('click', () => modal.classList.add('visible'));
    }
    closeBtn.addEventListener('click', () => modal.classList.remove('visible'));

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('visible');
    });

    // Package Selection Helper
    window.selectPackage = (pkgName) => {
        modal.classList.add('visible');
        const reqArea = document.querySelector('textarea[name="specialRequests"]');
        if (reqArea) reqArea.value = `Interested in: ${pkgName} package`;
    }

    // --- 9. API INTEGRATIONS ---

    // Form Helper
    async function handleFormSubmit(event, endpoint) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const btn = form.querySelector('button[type="submit"]');
        const originalText = btn.innerText;

        btn.innerText = 'Processing...';
        btn.disabled = true;

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                alert(result.message);
                form.reset();
                if (modal.classList.contains('visible')) modal.classList.remove('visible');
            } else {
                alert('Error: ' + result.message);
            }
        } catch (error) {
            console.error(error);
            alert('Something went wrong. Please try again.');
        } finally {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }

    const bookingForm = document.getElementById('bookingForm');
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => handleFormSubmit(e, '/api/booking'));
    }

    const newsletterForm = document.getElementById('newsletterForm');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = newsletterForm.querySelector('input');
            const data = { email: input.value };

            try {
                const res = await fetch('/api/newsletter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await res.json();
                alert(result.message);
                input.value = '';
            } catch (err) {
                alert('Error subscribing.');
            }
        });
    }
});
