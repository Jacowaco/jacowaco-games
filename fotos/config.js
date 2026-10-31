/* Caza de fotos: configuración. Las consignas NO van acá: se cargan desde admin.html y quedan guardadas en los
   backends, así nadie las ve en GitHub ni en el celu antes de la largada. */
window.FOTOS_CONFIG = {
  // Supabase → Project Settings → API Keys: la URL y la publishable (o anon) key. Nunca la secret / service_role.
  supabase: { url: 'https://uxpioaydhdxfxxppwxmj.supabase.co', key: 'sb_publishable_4PSyNF-vbSywYt7AeN-apA_Yonrs5SM' },
  // Google Apps Script → Implementar → URL de la aplicación web (termina en /exec)
  google: { url: 'https://script.google.com/macros/s/AKfycbzjAxXu6zO09mAK8KonLqYEPl6QDKjaGG7rHoJU-8ban9D_9LUUKgpM1pdyH-nFGtFmeQ/exec' },
  // Dónde se sube cada foto primero; si falla o tarda, se sube al otro
  primario: 'supabase',
  // true: el botón abre la cámara directo (en Android no deja elegir de la galería)
  soloCamara: true,
  // Compresión antes de subir: lado más largo en px y calidad JPEG
  ladoMax: 1600,
  calidad: 0.8,
  equipos: [
    { id: 'ninja', nombre: 'Ninja' },
    { id: 'gay', nombre: 'Gay' },
    { id: 'patrio', nombre: 'Patrio' },
    { id: 'pinup', nombre: 'Pinup' },
  ],
};
