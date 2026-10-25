# Medida en navegador con la CPU frenada

Lo que se mide: el intervalo entre cuadros (`requestAnimationFrame`) de la escena en un navegador real, con la CPU
frenada por CDP (`Emulation.setCPUThrottlingRate`), igual que los scripts de FERN del Brotato. Criterio de MAIA:
p95 ≤ 16,8 ms a 6x. Un cuadro "perdido" es el que pasa de 18 ms (a 60 Hz el intervalo nunca baja de 16,7).

En la Alienware (Edge de Windows, desde WSL):

    PS=/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
    $PS -NoProfile -ExecutionPolicy Bypass -File 'C:\...\perf.ps1' -Url 'http://100.99.75.92:5190/escena.html?tema=medieval&seed=7' \
        -Throttle 6 -WarmMs 22000 -SampleMs 8000 -Out 'C:\...\perf.json' < /dev/null
    python3 scripts/perf/perf-stats.py /mnt/c/.../perf.json

`< /dev/null` hace falta: si no, PowerShell se come la entrada de un bucle de shell. Con la CPU a 6x el horneado tarda
~6 s: espera al menos 20 s antes de medir.

Primera medida (NARUTO, 2026-10-24, commit c96186a, Edge sin ventana en la Alienware): a 1x p95 16,8 y 0 % perdidos;
a 6x, cuadro de 43-77 ms y p95 de 67-133 ms en los tres temas (100 % perdidos). No cumple el criterio.
