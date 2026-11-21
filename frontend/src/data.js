// Date demonstrative. Se înlocuiesc cu apeluri către FastAPI când backendul e gata.
export const user = { name: 'Elena Popescu', first: 'Elena', initials: 'EP', caregiver: 'Andrei P.', caregiverFull: 'Andrei Popescu' };

export const seedMeds = [
  { id: 1, name: 'Amlodipină', strength: '5 mg', aruco: 1, perDose: 1, stock: 18, times: ['08:00'] },
  { id: 2, name: 'Metformin', strength: '500 mg', aruco: 2, perDose: 1, stock: 3, times: ['14:00'], note: 'după masă' },
  { id: 3, name: 'Atorvastatină', strength: '20 mg', aruco: 3, perDose: 1, stock: 24, times: ['20:00'] },
];

export const seedDoses = [
  { id: 'd1', medId: 1, time: '08:00', status: 'confirmed', at: '08:03' },
  { id: 'd2', medId: 2, time: '14:00', status: 'accessed', at: '14:02' },
  { id: 'd3', medId: 3, time: '20:00', status: 'scheduled' },
];

export const seedEvents = [
  { id: 'e3', medId: 2, when: 'Azi, 14:02', desc: 'Flacon ridicat și reașezat (LED verde)', status: 'accessed' },
  { id: 'e2', medId: 1, when: 'Azi, 08:03', desc: 'Confirmare manuală în aplicație', status: 'confirmed' },
  { id: 'e1', medId: 3, when: 'Ieri, 20:04', desc: 'Întârziere > 3 min (Buzzer + Telegram)', status: 'alert' },
];
