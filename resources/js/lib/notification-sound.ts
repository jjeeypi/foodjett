let audioContext: AudioContext | null = null;

type BrowserWindow = Window & {
    webkitAudioContext?: typeof AudioContext;
};

export async function playNewOrderSound(): Promise<void> {
    try {
        const AudioContextConstructor =
            window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;

        if (!AudioContextConstructor) {
            return;
        }

        audioContext ??= new AudioContextConstructor();

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        const start = audioContext.currentTime;

        [659.25, 880].forEach((frequency, index) => {
            const oscillator = audioContext!.createOscillator();
            const gain = audioContext!.createGain();
            const noteStart = start + index * 0.16;

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, noteStart);
            gain.gain.setValueAtTime(0.0001, noteStart);
            gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.18);
            oscillator.connect(gain);
            gain.connect(audioContext!.destination);
            oscillator.start(noteStart);
            oscillator.stop(noteStart + 0.2);
        });
    } catch {
        // Browsers may block audio until the user has interacted with the page.
    }
}
