export const PH_PROVINCES_BY_REGION: Record<string, string[]> = {
  'National Capital Region (NCR)': ['Metro Manila'],
  'Cordillera Administrative Region (CAR)': ['Abra', 'Apayao', 'Benguet', 'Ifugao', 'Kalinga', 'Mountain Province'],
  'Region I - Ilocos Region': ['Ilocos Norte', 'Ilocos Sur', 'La Union', 'Pangasinan'],
  'Region II - Cagayan Valley': ['Batanes', 'Cagayan', 'Isabela', 'Nueva Vizcaya', 'Quirino'],
  'Region III - Central Luzon': ['Aurora', 'Bataan', 'Bulacan', 'Nueva Ecija', 'Pampanga', 'Tarlac', 'Zambales'],
  'Region IV-A - CALABARZON': ['Batangas', 'Cavite', 'Laguna', 'Quezon', 'Rizal'],
  'MIMAROPA Region': ['Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'],
  'Region V - Bicol Region': ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'],
  'Region VI - Western Visayas': ['Aklan', 'Antique', 'Capiz', 'Guimaras', 'Iloilo', 'Negros Occidental'],
  'Region VII - Central Visayas': ['Bohol', 'Cebu', 'Negros Oriental', 'Siquijor'],
  'Region VIII - Eastern Visayas': ['Biliran', 'Eastern Samar', 'Leyte', 'Northern Samar', 'Samar', 'Southern Leyte'],
  'Region IX - Zamboanga Peninsula': ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay'],
  'Region X - Northern Mindanao': ['Bukidnon', 'Camiguin', 'Lanao del Norte', 'Misamis Occidental', 'Misamis Oriental'],
  'Region XI - Davao Region': ['Davao de Oro', 'Davao del Norte', 'Davao del Sur', 'Davao Occidental', 'Davao Oriental'],
  'Region XII - SOCCSKSARGEN': ['Cotabato', 'Sarangani', 'South Cotabato', 'Sultan Kudarat'],
  'Region XIII - Caraga': ['Agusan del Norte', 'Agusan del Sur', 'Dinagat Islands', 'Surigao del Norte', 'Surigao del Sur'],
  'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)': ['Basilan', 'Lanao del Sur', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi'],
};

export const CITIES_BY_PROVINCE: Record<string, string[]> = {
  'Metro Manila': ['Caloocan', 'Las Piñas', 'Makati', 'Malabon', 'Mandaluyong', 'Manila', 'Marikina', 'Muntinlupa', 'Navotas', 'Parañaque', 'Pasay', 'Pasig', 'Quezon City', 'San Juan', 'Taguig', 'Valenzuela', 'Pateros'],
  'Davao del Norte': ['Panabo City', 'Tagum City', 'Samal City', 'Asuncion', 'Braulio E. Dujali', 'Carmen', 'Kapalong', 'New Corella', 'San Isidro', 'Santo Tomas', 'Talaingod'],
  'Davao del Sur': ['Davao City', 'Digos City', 'Bansalan', 'Hagonoy', 'Kiblawan', 'Magsaysay', 'Malalag', 'Matanao', 'Padada', 'Santa Cruz', 'Sulop'],
  'Davao Oriental': ['Mati City', 'Baganga', 'Banaybanay', 'Boston', 'Caraga', 'Cateel', 'Governor Generoso', 'Lupon', 'Manay', 'San Isidro', 'Tarragona'],
  'Davao de Oro': ['Nabunturan', 'Monkayo', 'Mawab', 'Maco', 'Maragusan', 'Laak', 'Compostela', 'Montevista', 'New Bataan', 'Pantukan'],
  'Davao Occidental': ['Malita', 'Don Marcelino', 'Jose Abad Santos', 'Santa Maria', 'Sarangani'],
  'Cotabato': ['Kidapawan City', 'Alamada', 'Aleosan', 'Antipas', 'Arakan', 'Banisilan', 'Carmen', 'Kabacan', 'Libungan', 'Matalam', 'Midsayap', 'Pigcawayan', 'Pikit', 'President Roxas', 'Tulunan'],
  'South Cotabato': ['Koronadal City', 'General Santos City', 'Polomolok', 'Tupi', 'Tampakan', 'Surallah', 'Tboli', 'Lake Sebu', 'Norala', 'Banga', 'Sto. Niño'],
  'Sarangani': ['Alabel', 'Glan', 'Kiamba', 'Maasim', 'Maitum', 'Malapatan', 'Malungon'],
  'Sultan Kudarat': ['Isulan', 'Tacurong City', 'Bagumbayan', 'Columbio', 'Esperanza', 'Kalamansig', 'Lambayong', 'Lebak', 'Lutayan', 'Palimbang', 'President Quirino', 'Senator Ninoy Aquino'],
  'Cebu': ['Cebu City', 'Mandaue City', 'Lapu-Lapu City', 'Talisay City', 'Danao City', 'Toledo City', 'Carcar City', 'Naga City'],
  'Iloilo': ['Iloilo City', 'Passi City', 'Oton', 'Pavia', 'Santa Barbara', 'Miagao', 'Pototan'],
  'Cavite': ['Bacoor City', 'Cavite City', 'Dasmariñas City', 'General Trias City', 'Imus City', 'Tagaytay City', 'Trece Martires City'],
  'Laguna': ['Calamba City', 'San Pablo City', 'Santa Rosa City', 'Biñan City', 'Cabuyao City', 'Los Baños', 'Pagsanjan'],
  'Batangas': ['Batangas City', 'Lipa City', 'Tanauan City', 'Santo Tomas City', 'Nasugbu', 'Lemery'],
  'Pampanga': ['Angeles City', 'San Fernando City', 'Mabalacat City', 'Apalit', 'Guagua', 'Lubao', 'Mexico'],
  'Bulacan': ['Malolos City', 'Meycauayan City', 'San Jose del Monte City', 'Baliuag', 'Bocaue', 'Marilao', 'Plaridel'],
};

export const ZIP_BY_CITY: Record<string, string> = {
  'Panabo City': '8105', 'Tagum City': '8100', 'Samal City': '8119', 'Davao City': '8000', 'Digos City': '8002', 'Mati City': '8200',
  'Nabunturan': '8800', 'Malita': '8012', 'Kidapawan City': '9400', 'Koronadal City': '9506', 'General Santos City': '9500',
  'Alabel': '9501', 'Isulan': '9805', 'Tacurong City': '9800', 'Cebu City': '6000', 'Mandaue City': '6014', 'Lapu-Lapu City': '6015',
  'Iloilo City': '5000', 'Bacoor City': '4102', 'Dasmariñas City': '4114', 'Imus City': '4103', 'Calamba City': '4027',
  'Santa Rosa City': '4026', 'Batangas City': '4200', 'Lipa City': '4217', 'Angeles City': '2009', 'San Fernando City': '2000',
  'Malolos City': '3000', 'Quezon City': '1100', 'Manila': '1000', 'Makati': '1200', 'Taguig': '1630', 'Pasig': '1600',
};

export const BARANGAYS_BY_CITY: Record<string, string[]> = {
  'Panabo City': ['A.O. Floirendo', 'Buenavista', 'Cacao', 'Cagangohan', 'Consolacion', 'Dapco', 'Gredu', 'J.P. Laurel', 'Kasilak', 'Katipunan', 'Katualan', 'Kauswagan', 'Kiotoy', 'Little Panay', 'Lower Panaga', 'Mabunao', 'Maduao', 'Malativas', 'Manay', 'Nanyo', 'New Malaga', 'New Malitbog', 'New Pandan', 'New Visayas', 'Quezon', 'Salvacion', 'San Francisco', 'San Nicolas', 'San Pedro', 'San Roque', 'San Vicente', 'Santa Cruz', 'Santo Niño', 'Sindaton', 'Southern Davao', 'Tagpore', 'Tibungol', 'Upper Licanan', 'Waterfall'],
  'Davao City': ['Agdao', 'Baguio Proper', 'Buhangin', 'Calinan', 'Catalunan Grande', 'Matina Crossing', 'Mintal', 'Poblacion', 'Sasa', 'Talomo Proper', 'Toril'],
  'Tagum City': ['Apokon', 'Magugpo East', 'Magugpo North', 'Magugpo Poblacion', 'Magugpo South', 'Magugpo West', 'Mankilam', 'Visayan Village'],
  'Mati City': ['Central', 'Dahican', 'Don Enrique Lopez', 'Sainz', 'Tamisan'],
};

export function completeApplicantAddress(profile: Record<string, any>): Record<string, any> {
  const result = { ...profile };
  if ((result.currentCountry || 'Philippines') === 'Philippines' && result.currentCity) {
    const provinces = Object.entries(CITIES_BY_PROVINCE).filter(([, cities]) => cities.includes(result.currentCity)).map(([province]) => province);
    if (!result.currentProvince && provinces.length === 1) result.currentProvince = provinces[0];
    const regions = Object.entries(PH_PROVINCES_BY_REGION).filter(([, provinces]) => provinces.includes(result.currentProvince)).map(([region]) => region);
    if (!result.currentRegion && regions.length === 1) result.currentRegion = regions[0];
    if (!result.currentZipCode) result.currentZipCode = ZIP_BY_CITY[result.currentCity] || '';
  }
  return result;
}
