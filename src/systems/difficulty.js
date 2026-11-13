/** Tunable stealth, stamina, and patrol settings selected before a night begins. */
export const DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: 'easy', label: 'Лёгкая', guardSight: 0.78, suspicionGain: 0.72, hearing: 0.72,
    patrolSpeed: 0.92, chaseSpeed: 0.88, chaseDuration: 5.4, searchDuration: 4.0,
    staminaDrain: 15, staminaRegen: 23, policeFirst: 105, policeEvery: 145,
    cameraGain: 0.48, hideSearch: 3.6,
  }),
  medium: Object.freeze({
    id: 'medium', label: 'Средняя', guardSight: 1, suspicionGain: 1, hearing: 1,
    patrolSpeed: 1, chaseSpeed: 1, chaseDuration: 7.0, searchDuration: 6.0,
    staminaDrain: 22, staminaRegen: 17, policeFirst: 75, policeEvery: 115,
    cameraGain: 0.72, hideSearch: 5.2,
  }),
  hard: Object.freeze({
    id: 'hard', label: 'Сложная', guardSight: 1.16, suspicionGain: 1.28, hearing: 1.22,
    patrolSpeed: 1.12, chaseSpeed: 1.15, chaseDuration: 9.2, searchDuration: 8.2,
    staminaDrain: 30, staminaRegen: 12, policeFirst: 58, policeEvery: 86,
    cameraGain: 1, hideSearch: 7.5,
  }),
});

export function getDifficulty(id = 'medium') {
  return DIFFICULTIES[id] || DIFFICULTIES.medium;
}
