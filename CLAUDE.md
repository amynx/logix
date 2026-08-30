# Estándares de desarrollo y calidad del proyecto

Antes de implementar cualquier funcionalidad, estas reglas son **criterios generales y
obligatorios de desarrollo** para todo el proyecto.

El objetivo no es solamente conseguir una aplicación funcional, sino construir una base de
código **limpia, comprensible, mantenible y preparada para evolucionar**.

---

## 1. Principios de diseño

### SOLID

Aplica los principios SOLID cuando aporten valor real al diseño:

- **S — Single Responsibility:** cada módulo, clase o función tiene una responsabilidad clara.
- **O — Open/Closed:** favorecer estructuras extensibles sin modificar innecesariamente código
  existente.
- **L — Liskov Substitution:** cuando exista herencia o abstracción, las implementaciones deben
  poder sustituirse correctamente.
- **I — Interface Segregation:** evitar interfaces o abstracciones excesivamente grandes.
- **D — Dependency Inversion:** las partes de alto nivel no deben depender innecesariamente de
  implementaciones concretas.

### Importante sobre SOLID

No apliques SOLID de manera dogmática. No crees:

- Clases innecesarias.
- Interfaces artificiales.
- Abstracciones prematuras.
- Patrones de diseño solo para demostrar que se aplica SOLID.
- Capas adicionales que no aporten valor.

**KISS tiene prioridad frente a la sobreingeniería.** Si una función sencilla resuelve el
problema, no la conviertas en varias clases, fábricas o abstracciones.

---

## 2. KISS — Keep It Simple

Prioriza soluciones simples. Antes de implementar algo complejo, pregunta:

> ¿Existe una forma más sencilla de resolver esto sin perder claridad, mantenibilidad o
> funcionalidad?

Evita: complejidad innecesaria, dependencias innecesarias, abstracciones prematuras, código
genérico que aún no necesita serlo, configuraciones excesivas, arquitecturas desproporcionadas.

La simplicidad no es código improvisado: es la solución más sencilla que resuelve
correctamente el problema actual.

---

## 3. Clean Code

Prioriza: nombres descriptivos, funciones pequeñas y enfocadas, responsabilidades claras, bajo
acoplamiento, alta cohesión, evitar duplicación innecesaria, evitar efectos secundarios
inesperados, evitar demasiados parámetros, evitar condiciones excesivamente complejas, y evitar
comentarios que describan lo que el código ya expresa.

Prefiere código cuyo propósito se comprenda leyendo su estructura y sus nombres. Por ejemplo,
preferir `saveAnalysis(analysis)` sobre `processData(data)` cuando el primero describe
claramente la responsabilidad.

---

## 4. Convenciones de nombres (JavaScript)

- **Variables y funciones:** `camelCase` — `currentAnalysis`, `saveAnalysis()`, `updateRow()`.
- **Clases:** `PascalCase` — `AnalysisModel`, `FileService`, `StorageService`.
- **Constantes:** `UPPER_SNAKE_CASE` solo cuando sea una constante global o de configuración —
  `MAX_FILE_SIZE`, `DEFAULT_ANALYSIS_VERSION`. No para toda variable que simplemente no cambia.

---

## 5. Nombres de archivos

Consistentes y descriptivos. Para módulos JS: `camelCase` — `analysisModel.js`,
`fileService.js`, `storageService.js`. El nombre del archivo debe corresponder con la
responsabilidad del módulo.

Evita nombres genéricos: `helpers.js`, `utils2.js`, `misc.js`, `stuff.js`, `manager.js`. Si
necesitas un módulo de utilidades, sus funciones deben tener una responsabilidad claramente
relacionada.

---

## 6. Funciones

Cada función tiene una responsabilidad concreta. Evita funciones que a la vez modifiquen el
estado, manipulen el DOM, guarden en IndexedDB, generen archivos y validen datos. Divide las
responsabilidades:

```text
Usuario modifica una fila
        ↓
Controller recibe evento → actualiza Model → Storage guarda → View actualiza interfaz
```

La función que guarda en IndexedDB no debe conocer detalles del DOM, y viceversa.

---

## 7. Estado

Debe existir una **fuente de verdad clara** para el estado del análisis. Evita almacenar el
mismo dato en múltiples lugares sin razón. **No uses el DOM como fuente principal del estado.**
El estado representa los datos reales; la interfaz es una representación de ese estado.

```text
Usuario → Evento → Controller → Estado/Modelo → Persistencia → Vista
```

---

## 8. Manipulación del DOM

Mantén separada la lógica de negocio de la manipulación del DOM. `calculateSomething()` no debe
depender de elementos HTML; `renderAnalysis()` sí puede representar información en el DOM. Esto
permite reutilizar la lógica del análisis para generar pseudocódigo u otras representaciones.

---

## 9. Manejo de errores

Los errores se manejan explícitamente; no los ocultes silenciosamente. Distingue entre: error
de validación del usuario, error al leer un archivo, archivo con formato inválido, error de
persistencia, y error inesperado.

Los mensajes al usuario deben ser claros. En vez de `SyntaxError: Unexpected token...`, mostrar:

> El archivo seleccionado no tiene un formato de análisis válido.

Los errores técnicos permanecen disponibles para depuración vía `console.error`.

---

## 10. Validación y límites

La validación existe principalmente en los **límites del sistema**:

```text
Archivo importado → Validación → Modelo interno
```

No asumas que un archivo importado es válido. Valida también el estado antes de exportarlo
cuando sea necesario. Mantén la validación separada de la representación visual.

---

## 11. Persistencia

La lógica de IndexedDB debe estar desacoplada del resto de la aplicación. El resto no debe
conocer nombres de object stores, transacciones, claves internas ni detalles de IndexedDB. Usa
una abstracción clara:

```javascript
storage.saveAnalysis(analysis)
storage.getAnalysis(id)
storage.deleteAnalysis(id)
```

Así se puede cambiar la implementación de almacenamiento sin modificar toda la aplicación.

---

## 12. Importación y exportación

La lógica de archivos separada de la interfaz — `fileService.exportAnalysis(analysis)`,
`fileService.importAnalysis(file)`. El componente visual no construye el JSON directamente.

```text
Modelo → Serialización → Archivo
Archivo → Deserialización → Validación → Modelo
```

---

## 13. Dependencias

Mantén las dependencias al mínimo. Antes de incorporar una librería, evalúa si la funcionalidad
puede implementarse con APIs nativas del navegador. Para la primera versión **no** se necesitan
librerías para: estado, drag & drop, persistencia, importación/exportación, ni manipulación
básica del DOM. Si más adelante una dependencia es claramente beneficiosa, justifícala.

---

## 14. Comentarios y documentación

No llenes el código de comentarios innecesarios. Prefiere `const analysisVersion = 1;` sin un
comentario que repita lo evidente. Los comentarios deben explicar: **por qué** existe una
decisión, restricciones importantes, comportamientos no obvios y decisiones arquitectónicas.

---

## 15. Código duplicado

Evita duplicación innecesaria, pero no extraigas toda coincidencia hacia una abstracción.
Primero determina si existe un concepto compartido real. Es preferible una pequeña duplicación
comprensible que una abstracción artificial difícil de entender.

---

## 16. Git

Commits **pequeños, cohesivos, relacionados con un único cambio lógico, fáciles de revisar y de
revertir**. Evita commits gigantes que mezclen múltiples funcionalidades (p. ej. un solo
`feat: create application` con arquitectura + tabla + persistencia + importación + estilos).

---

## 17. Convención de commits

Inspirada en **Conventional Commits**: `<type>(<scope>): <description>`

```text
feat(analysis): add analysis model
feat(storage): implement IndexedDB persistence
fix(table): preserve row data after reordering
refactor(storage): isolate IndexedDB implementation
docs(readme): document project setup
```

---

## 18. Tipos de commit permitidos

- **`feat`** — nueva funcionalidad.
- **`fix`** — corrección de un error.
- **`refactor`** — cambio interno sin modificar el comportamiento esperado.
- **`style`** — solo formato o estilos.
- **`docs`** — documentación.
- **`test`** — pruebas.
- **`chore`** — mantenimiento que no representa funcionalidad del producto.

---

## 19. Reglas para los mensajes de commit

- En **inglés**.
- Minúsculas después de `:`.
- Breves y específicos; describen el cambio, no una intención vaga.
- Ni demasiado largos ni vagos (`update`, `changes`, `fix things`, `implement everything`).

---

## 20. Commits durante la implementación

Organiza el trabajo en commits lógicos e incrementales. La regla principal: **cada commit
representa un cambio lógico y cohesivo.** No es obligatorio seguir una secuencia fija si durante
el desarrollo se encuentra una mejor división.

---

## 21. Calidad antes que velocidad

Antes de considerar terminada una funcionalidad, verifica:

- ¿El código tiene una responsabilidad clara?
- ¿El estado está correctamente modelado?
- ¿La lógica está desacoplada de la interfaz?
- ¿Se están duplicando responsabilidades?
- ¿Existe una solución más sencilla?
- ¿La implementación dificulta futuras extensiones?
- ¿Los nombres son claros?
- ¿Los errores están correctamente manejados?
- ¿La funcionalidad puede probarse aisladamente?

---

## 22. Regla general — orden de prioridades

```text
Correctitud → Claridad → Simplicidad → Mantenibilidad → Extensibilidad → Optimización
```

No optimices prematuramente. No introduzcas complejidad para problemas que aún no existen. La
arquitectura debe permitir la evolución del proyecto, no resolver desde ahora todas las
necesidades futuras.

---

## 23. Antes de implementar

1. Analiza los requisitos.
2. Identifica las entidades principales.
3. Define el modelo de datos.
4. Define las responsabilidades de cada módulo.
5. Identifica las dependencias entre módulos.
6. Propón la estructura inicial del proyecto.
7. Identifica posibles problemas de diseño.
8. Explica brevemente las decisiones importantes.

Después, implementa de manera incremental. Si un principio entra en conflicto con una necesidad
real, explica el conflicto y elige la solución más simple y razonable.

**No apliques ningún principio de manera dogmática.** El objetivo es producir software de
calidad, no demostrar el uso de patrones o principios.
