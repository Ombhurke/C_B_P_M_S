'use client';

import { useEffect, useState } from 'react';

export function useLandingExperience() {
  const [activeSection, setActiveSection] = useState('home');

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('landing-scroll');
    if (!('IntersectionObserver' in window)) return () => root.classList.remove('landing-scroll');

    const sections = Array.from(document.querySelectorAll<HTMLElement>('.landing-section'));
    const reveals = Array.from(document.querySelectorAll<HTMLElement>('.landing-page [data-reveal]'));
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealState = 'visible';
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    // Leave initial, already-revealed, and reduced-motion content visible.
    const updateMotion = () => {
      revealObserver.disconnect();
      reveals.forEach((element) => {
        if (reducedMotion.matches || element.getBoundingClientRect().top < window.innerHeight || element.dataset.revealState === 'visible') {
          element.dataset.revealState = 'visible';
        } else {
          element.dataset.revealState = 'pending';
          revealObserver.observe(element);
        }
      });
    };
    updateMotion();
    reducedMotion.addEventListener('change', updateMotion);

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); });
    }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
    sections.forEach((section) => sectionObserver.observe(section));

    return () => {
      root.classList.remove('landing-scroll');
      revealObserver.disconnect();
      sectionObserver.disconnect();
      reducedMotion.removeEventListener('change', updateMotion);
      reveals.forEach((element) => delete element.dataset.revealState);
    };
  }, []);

  return activeSection;
}
