"use client";

import {
  Activity,
  ArrowRightLeft,
  AudioLines,
  Download,
  Gauge,
  HelpCircle,
  History,
  Keyboard,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Waves,
  Zap,
} from "lucide-react";
import { useStudio } from "@/lib/store";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof HelpCircle;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.06] bg-black/20 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-md border border-lime-acid/20 bg-lime-acid/[0.06] text-lime-acid/80">
          <Icon size={13} />
        </span>
        <h3 className="text-[11.5px] font-semibold text-white">{title}</h3>
      </div>
      <div className="space-y-1.5 text-[9px] leading-relaxed text-ink-400">{children}</div>
    </section>
  );
}

function Item({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-acid/50" />
      <div>
        <span className="font-medium text-ink-200">{title}: </span>
        <span>{text}</span>
      </div>
    </div>
  );
}

export function HelpModal() {
  const open = useStudio((state) => state.helpOpen);
  const openHelp = useStudio((state) => state.openHelp);
  const track = useStudio((state) => state.track);

  return (
    <Modal
      open={open}
      onClose={() => openHelp(false)}
      title="Centro de ayuda"
      subtitle="Guía completa de MasterAI Pro: cada función y cómo usarla"
      width="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[8px] text-ink-500">
            Atajos: Espacio · B · L · E · H · ?
          </span>
          <Button variant="secondary" size="sm" onClick={() => openHelp(false)}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-lime-acid/15 bg-gradient-to-r from-lime-acid/[0.08] to-transparent p-3.5">
          <h3 className="text-[12px] font-semibold text-white">Flujo rápido recomendado</h3>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[9px] leading-relaxed text-ink-300">
            <li>Sube tu mezcla en WAV, MP3 o FLAC (hasta 500 MB).</li>
            <li>Elige el género y la plataforma de destino en el panel izquierdo.</li>
            <li>Pulsa Auto-Master IA para aplicar una cadena inicial.</li>
            <li>Escucha con los botones A / B para comparar original y master.</li>
            <li>Ajusta módulos manualmente si lo necesitas.</li>
            <li>Pulsa Analizar para comprobar LUFS y true peak.</li>
            <li>Exporta en WAV 24-bit/48 kHz o MP3 320 kbps.</li>
          </ol>
        </div>

        <Section icon={Upload} title="Cargar audio">
          <Item
            title="Seleccionar archivo"
            text="Arrastra tu tema al área central o haz clic en Seleccionar audio. Formatos soportados: MP3, WAV y FLAC. Tamaño máximo 500 MB. Se valida la tasa de muestreo (44.1/48 kHz) y se convierte internamente a 48 kHz para el procesado."
          />
          <Item
            title="Metadatos y análisis de origen"
            text="Al cargar se muestra duración, canales, sample rate, tamaño y la sonoridad de entrada medida con EBU R128 (LUFS integrada, true peak 4x, LRA y crest factor). Estos datos son la referencia Original."
          />
          <Item
            title="Quitar pista"
            text="Usa el botón de borrar junto al nombre del archivo para descargar la pista y liberar memoria. Puedes cargar otra inmediatamente."
          />
        </Section>

        <Section icon={Waves} title="Reproducción y transporte">
          <Item
            title="Play / Pausa"
            text="Botón circular verde o atajo Espacio. Inicia la vista previa en tiempo real con la cadena DSP activa y el limitador aproximado. El tiempo transcurrido se actualiza frame a frame."
          />
          <Item
            title="Detener"
            text="Vuelve al inicio (0:00) y detiene la reproducción."
          />
          <Item
            title="Loop / repetición"
            text="Activa el bucle de toda la pista o, si has seleccionado una región, solo de esa región. Atajo L. Útil para comparar ajustes en una sección."
          />
          <Item
            title="Seek"
            text="Haz clic en la forma de onda para saltar a cualquier punto. La reproducción continúa desde ahí."
          />
          <Item
            title="Volumen del monitor"
            text="Control deslizante y botón de mute. Solo afecta a lo que escuchas, no al archivo exportado."
          />
        </Section>

        <Section icon={ArrowRightLeft} title="Comparar original vs. remasterizado (A/B)">
          <Item
            title="Botones A y B"
            text="En la barra de transporte y en el encabezado aparecen los botones Original (A) y Master (B). A reproduce la mezcla sin procesar; B aplica la cadena MasterAI. Puedes cambiar mientras suena sin cortes."
          />
          <Item
            title="Atajo B"
            text="La tecla B alterna entre original y masterizado instantáneamente. Ideal para evaluar mejoras de forma objetiva."
          />
          <Item
            title="Indicador de estado"
            text="El chip ESCUCHANDO MASTER / ORIGINAL y el punto de color (lima = master, ambar = original) indican qué estás escuchando."
          />
          <Item
            title="Comparativa numérica"
            text="El panel Original vs. master muestra LUFS integrada, true peak, LRA y crest factor antes y después, con la ganancia aplicada y la reducción del limitador. Pulsa Analizar cadena para renderizar offline y actualizar esos valores."
          />
          <Item
            title="Medidores en vivo"
            text="Los medidores (LUFS integrada/short-term, true peak, correlación y ganancia reducida) reflejan la señal que estás escuchando en cada momento, así puedes comparar dinámica y fase."
          />
        </Section>

        <Section icon={Activity} title="Waveform y regiones">
          <Item
            title="Forma de onda interactiva"
            text="Visualización con zoom y desplazamiento. Muestra el audio completo con resolución adaptativa."
          />
          <Item
            title="Seleccionar región"
            text="Arrastra sobre la onda para marcar un tramo. Aparece el rango y su duración. El loop se limita a esa región y la exportación puede hacerse solo de la selección."
          />
          <Item
            title="Limpiar selección"
            text="Vuelve a Pista completa haciendo clic fuera de la región o cargando de nuevo la pista."
          />
        </Section>

        <Section icon={SlidersHorizontal} title="Analizadores">
          <Item
            title="Espectro (FFT)"
            text="Muestra el espectro de frecuencias en tiempo real con escala logarítmica y peak hold. Útil para detectar desequilibrios de graves, medios y agudos."
          />
          <Item
            title="EQ gráfico"
            text="Editor con nodos arrastrables: frecuencia (eje X), ganancia (eje Y) y Q (rueda o doble clic). Doble clic en un nodo resetea su ganancia a 0. Los cambios se reflejan al instante en la vista previa."
          />
          <Item
            title="Fase / goniómetro"
            text="Lissajous estéreo y correlación en tiempo real. Correlación cercana a +1 = mono compatible; valores negativos indican problemas de fase o cancelación."
          />
        </Section>

        <Section icon={Gauge} title="Cadena DSP (módulos)">
          <Item
            title="Ganancia de entrada / salida"
            text="Ajusta el nivel de entrada y el trim de salida en dB. El trim se aplica antes del limitador de vista previa."
          />
          <Item
            title="Filtro"
            text="High-pass (10-120 Hz) y low-pass (6-20 kHz) biquad de 12 dB/oct para limpiar subgraves y aire. Actívalo o desactívalo con el interruptor."
          />
          <Item
            title="EQ paramétrico (5 bandas)"
            text="Low shelf 80 Hz, peaking 250/1000/3500 Hz y high shelf 12 kHz. Gana +-18 dB. Cada banda tiene frecuencia, ganancia y Q. Se puede desactivar por completo."
          />
          <Item
            title="Compresor"
            text="Umbral, ratio, attack, release, makeup y knee. Modo multibanda divide en 3 bandas (220 Hz / 3.5 kHz) para controlar graves, medios y agudos por separado. El medidor GR muestra la reducción."
          />
          <Item
            title="Saturación"
            text="Drive, mix y tone con curva tanh. Añade armónicos y densidad analógica. El gráfico muestra la curva de transferencia en tiempo real."
          />
          <Item
            title="Limitador"
            text="Brickwall con techo fijo a -1.0 dBTP (estándar de streaming). Release ajustable. La vista previa usa un compresor rápido; la exportación aplica un limitador true-peak 4x con lookahead."
          />
          <Item
            title="Activar/desactivar módulos"
            text="Cada módulo tiene un interruptor. Desactivarlo pone ese bloque en bypass y actualiza la vista previa al instante."
          />
        </Section>

        <Section icon={Sparkles} title="Auto-Master IA">
          <Item
            title="Qué hace"
            text="Analiza el balance espectral, la dinámica y la sonoridad de tu mezcla y ajusta los seis módulos DSP automáticamente según el género y la plataforma elegidos."
          />
          <Item
            title="Informe"
            text="Al terminar se abre un modal con las decisiones del motor, los valores de EQ y compresión aplicados, y la ganancia de entrada/salida. Puedes revisar la cadena o exportar directamente."
          />
          <Item
            title="Manual después"
            text="Auto-Master es un punto de partida. Todos los parámetros quedan editables; la exportación vuelve a medir y normalizar el resultado final."
          />
        </Section>

        <Section icon={Activity} title="Análisis offline">
          <Item
            title="Analizar cadena"
            text="Renderiza offline la cadena actual, mide LUFS integrada, true peak, LRA y crest factor del resultado, y muestra la ganancia aplicada y la reducción del limitador. Úsalo antes de exportar para verificar el cumplimiento del objetivo."
          />
          <Item
            title="Objetivo y techo"
            text="Objetivos: Spotify/Apple -14 LUFS, YouTube -13, SoundCloud -9. Techo de true peak -1.0 dBTP. El indicador En objetivo se enciende cuando se cumplen ambas condiciones."
          />
        </Section>

        <Section icon={Download} title="Exportación">
          <Item
            title="Formatos"
            text="WAV 24-bit / 48 kHz (sin pérdida) o MP3 320 kbps CBR. El render se ejecuta a 48 kHz con normalización iterativa hasta alcanzar el objetivo."
          />
          <Item
            title="Normalizar loudness"
            text="Activa/desactiva la normalización. Si está activa, ajusta la ganancia y limita picos hasta alcanzar el LUFS objetivo con el techo configurado."
          />
          <Item
            title="Exportar selección"
            text="Si has marcado una región, puedes exportar solo ese tramo. De lo contrario se exporta la pista completa."
          />
          <Item
            title="Progreso y resultado"
            text="Se muestra un progreso por fases (render, medición, limitación, codificación). Al finalizar aparece un resumen con LUFS, true peak, LRA y tamaño, y el botón de descarga."
          />
          <Item
            title="Historial"
            text="Cada exportación se guarda automáticamente en el historial local (hasta 8 masters) con sus ajustes y el archivo final."
          />
        </Section>

        <Section icon={History} title="Historial local">
          <Item
            title="Abrir historial"
            text="Botón de reloj en el encabezado o atajo H. Muestra todos los masters guardados con fecha, plataforma, género, duración y tamaño."
          />
          <Item
            title="Descargar de nuevo"
            text="Cada entrada tiene Descargar para recuperar el archivo final sin volver a renderizar."
          />
          <Item
            title="Cargar ajustes"
            text="Cargar ajustes aplica la configuración de ese master a la pista actual. Útil para repetir un sonido."
          />
          <Item
            title="Eliminar / borrar todo"
            text="Puedes borrar una entrada individual o todo el historial. Se muestra el uso de almacenamiento del navegador."
          />
        </Section>

        <Section icon={Keyboard} title="Atajos de teclado">
          <Item title="Espacio" text="Play / Pausa." />
          <Item title="B" text="Alternar A/B (original / master)." />
          <Item title="L" text="Activar/desactivar loop." />
          <Item title="E" text="Abrir diálogo de exportación (con pista cargada)." />
          <Item title="H" text="Abrir historial." />
          <Item title="?" text="Abrir esta ayuda." />
        </Section>

        <Section icon={Zap} title="Consejos y buenas prácticas">
          <Item
            title="Mezcla antes de masterizar"
            text="Deja margen de pico (-6 a -3 dBTP) y evita limitadores en la mezcla. MasterAI asume que la mezcla ya está balanceada."
          />
          <Item
            title="Escucha en varios sistemas"
            text="Compara en auriculares, monitores y móvil. Usa el loop sobre la sección más densa para ajustar el compresor."
          />
          <Item
            title="No abuses del limitador"
            text="Si la reducción supera 4-5 dB, baja el umbral del compresor o la ganancia de entrada para preservar dinámica."
          />
          <Item
            title="Privacidad"
            text="Todo el procesado y la codificación ocurren en tu navegador. Ningún audio sale de tu dispositivo."
          />
        </Section>

        {!track && (
          <div className="rounded-xl border border-dashed border-white/[0.1] bg-white/[0.012] p-3 text-center text-[9px] text-ink-500">
            Carga una pista para activar la reproducción, los medidores y la exportación.
          </div>
        )}
      </div>
    </Modal>
  );
}
