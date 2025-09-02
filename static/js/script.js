document.addEventListener('DOMContentLoaded', () => {
    const audioFileInput = document.getElementById('audioFileInput');
    const uploadButton = document.getElementById('uploadButton');
    const predictedConditionSpan = document.getElementById('predictedCondition');
    const recommendationSpan = document.getElementById('recommendation');
    const loadingDiv = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const waveformDiv = document.getElementById('waveform');

    let wavesurfer = null;

    // Initialize Wavesurfer
    const initWaveSurfer = () => {
        if (wavesurfer) {
            wavesurfer.destroy();
        }
        wavesurfer = WaveSurfer.create({
            container: '#waveform',
            waveColor: '#4F4F4F',
            progressColor: '#28a745',
            cursorColor: '#0a7a2d',
            barWidth: 2,
            height: 100,
            responsive: true,
            hideScrollbar: true,
            backend: 'MediaElement' // Use MediaElement backend for better compatibility
        });
    };

    initWaveSurfer();

    audioFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            errorDiv.classList.add('hidden');
            predictedConditionSpan.textContent = 'N/A';
            recommendationSpan.textContent = 'N/A';
            
            const reader = new FileReader();
            reader.onload = (e) => {
                wavesurfer.load(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });

    uploadButton.addEventListener('click', async () => {
        const audioFile = audioFileInput.files[0];
        if (!audioFile) {
            errorDiv.textContent = 'Please select an audio file.';
            errorDiv.classList.remove('hidden');
            return;
        }

        loadingDiv.classList.remove('hidden');
        errorDiv.classList.add('hidden');
        predictedConditionSpan.textContent = 'Analyzing...';
        recommendationSpan.textContent = 'Analyzing...';

        const formData = new FormData();
        formData.append('audio', audioFile);

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                predictedConditionSpan.textContent = result.predicted_condition;
                recommendationSpan.textContent = result.recommendation;
            } else {
                errorDiv.textContent = result.error || 'An unknown error occurred.';
                errorDiv.classList.remove('hidden');
                predictedConditionSpan.textContent = 'Error';
                recommendationSpan.textContent = 'Error';
            }
        } catch (error) {
            console.error('Error during prediction:', error);
            errorDiv.textContent = 'Network error or server unavailable.';
            errorDiv.classList.remove('hidden');
            predictedConditionSpan.textContent = 'Error';
            recommendationSpan.textContent = 'Error';
        } finally {
            loadingDiv.classList.add('hidden');
        }
    });
});
