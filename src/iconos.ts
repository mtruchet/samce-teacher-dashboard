/**
 * Los iconos que usa el sitio, uno por uno.
 *
 * Importar desde `@phosphor-icons/react` trae el índice del paquete entero:
 * en desarrollo son diecisiete megas de JavaScript que el navegador descarga
 * antes de poder pintar nada, y son la mayor parte del hueco en blanco del
 * arranque. Cada archivo suelto pesa unos trescientos bytes.
 *
 * Están todos acá y no repartidos por los componentes para que agregar uno
 * nuevo sea acordarse de un solo lugar, y para que la lista diga de un vistazo
 * cuántos iconos tiene el sitio de verdad.
 */
/** El tipo de cualquier icono, para los componentes que reciben uno como dato. */
export type { Icon } from "@phosphor-icons/react";

export { BroadcastIcon as Broadcast } from "@phosphor-icons/react/dist/icons/Broadcast";
export { SignOutIcon as SignOut } from "@phosphor-icons/react/dist/icons/SignOut";
export { SignInIcon as SignIn } from "@phosphor-icons/react/dist/icons/SignIn";
export { UserCircleIcon as UserCircle } from "@phosphor-icons/react/dist/icons/UserCircle";
export { UserIcon as Usuario } from "@phosphor-icons/react/dist/icons/User";
export { SquaresFourIcon as Tablero } from "@phosphor-icons/react/dist/icons/SquaresFour";
export { GraduationCapIcon as Materia } from "@phosphor-icons/react/dist/icons/GraduationCap";
export { ExamIcon as Examen } from "@phosphor-icons/react/dist/icons/Exam";
export { PencilSimpleIcon as Rindiendo } from "@phosphor-icons/react/dist/icons/PencilSimple";
export { CheckCircleIcon as Entregado } from "@phosphor-icons/react/dist/icons/CheckCircle";
export { CircleDashedIcon as SinNada } from "@phosphor-icons/react/dist/icons/CircleDashed";
/* El intento que venció o se dejó sin entregar. Un documento punteado y no
   una cruz ni una alerta: dice que quedó incompleto, no que algo esté mal. */
export { FileDashedIcon as SinEntregar } from "@phosphor-icons/react/dist/icons/FileDashed";
export { CheckIcon as Check } from "@phosphor-icons/react/dist/icons/Check";
export { WarningIcon as Warning } from "@phosphor-icons/react/dist/icons/Warning";
export { WarningCircleIcon as WarningCircle } from "@phosphor-icons/react/dist/icons/WarningCircle";
export { CaretDownIcon as CaretDown } from "@phosphor-icons/react/dist/icons/CaretDown";
export { CaretRightIcon as CaretRight } from "@phosphor-icons/react/dist/icons/CaretRight";
export { WaveSineIcon as WaveSine } from "@phosphor-icons/react/dist/icons/WaveSine";
export { BrainIcon as Brain } from "@phosphor-icons/react/dist/icons/Brain";
export { LinkIcon as Link } from "@phosphor-icons/react/dist/icons/Link";
export { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react/dist/icons/CircleNotch";
export { ArrowLeftIcon as ArrowLeft } from "@phosphor-icons/react/dist/icons/ArrowLeft";
export { ArrowRightIcon as ArrowRight } from "@phosphor-icons/react/dist/icons/ArrowRight";
export { ArrowSquareOutIcon as ArrowSquareOut } from "@phosphor-icons/react/dist/icons/ArrowSquareOut";

/* Uno por tipo de evento del registro. Todos del mismo trazo y del mismo
   tamaño, y ninguno de la familia de advertencia: acá el icono dice de qué
   clase es el evento, igual que su nombre escrito al lado, y nunca si conviene
   mirarlo. Por eso `Warning` y `WarningCircle`, que ya están arriba, no entran
   en esta lista. */
export { BrowserIcon as Navegador } from "@phosphor-icons/react/dist/icons/Browser";
export { KeyboardIcon as Teclado } from "@phosphor-icons/react/dist/icons/Keyboard";
export { MouseIcon as Raton } from "@phosphor-icons/react/dist/icons/Mouse";
export { EyeIcon as Ojo } from "@phosphor-icons/react/dist/icons/Eye";
export { EyeSlashIcon as OjoTachado } from "@phosphor-icons/react/dist/icons/EyeSlash";
export { ClipboardIcon as Portapapeles } from "@phosphor-icons/react/dist/icons/Clipboard";
export { TimerIcon as Cronometro } from "@phosphor-icons/react/dist/icons/Timer";
export { CornersOutIcon as CornersOut } from "@phosphor-icons/react/dist/icons/CornersOut";
export { CornersInIcon as CornersIn } from "@phosphor-icons/react/dist/icons/CornersIn";
export { FrameCornersIcon as Marco } from "@phosphor-icons/react/dist/icons/FrameCorners";
export { WifiHighIcon as Wifi } from "@phosphor-icons/react/dist/icons/WifiHigh";
export { WifiSlashIcon as WifiCortado } from "@phosphor-icons/react/dist/icons/WifiSlash";
export { ArrowUpRightIcon as ArrowUpRight } from "@phosphor-icons/react/dist/icons/ArrowUpRight";
export { ArrowDownLeftIcon as ArrowDownLeft } from "@phosphor-icons/react/dist/icons/ArrowDownLeft";
/* Los eventos que el complemento tuvo que tirar y nunca llegaron. Una nube
   tachada y no un cartel de alerta: dice que faltan datos, que es un hecho del
   monitoreo, y no que haya algo que mirar en el examen. */
export { CloudSlashIcon as NubeCortada } from "@phosphor-icons/react/dist/icons/CloudSlash";
/* El silencio del registro. Puntos suspensivos y no un reloj ni una señal
   cortada: sólo dice que ahí falta algo, sin arriesgar por qué. */
export { DotsThreeIcon as Silencio } from "@phosphor-icons/react/dist/icons/DotsThree";
