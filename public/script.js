const API_URL = 'https://prjnvbewxfegpbyavcrv.supabase.co/functions/v1/submit-code'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByam52YmV3eGZlZ3BieWF2Y3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTM5NjQsImV4cCI6MjA4MjQyOTk2NH0.LzR1Lf8VWVRH6yDYWtE30UKZul6tCModIQyrUz1rXNE';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('submission-form');
    const submitBtn = document.getElementById('submit-btn');
    const instructionZone = document.getElementById('instruction-zone');
    const responseZone = document.getElementById('response-zone');
    const responseMessage = document.getElementById('response-message');
    const mainContent = document.getElementById('main-content');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Disable button to prevent double submit
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        // 2. Collect data
        const formData = new FormData(form);
        const data = {
            firstName: formData.get('firstName'),
            phoneNumber: formData.get('phoneNumber'),
            code: formData.get('code')
        };

        try {
            // 3. Send request
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            // 4. Handle Response
            // Hide form and instruction
            form.classList.add('hidden');
            instructionZone.classList.add('hidden');

            // Show response
            responseZone.classList.remove('hidden');
            responseMessage.textContent = result.message || 'An error occurred. Please try again.';

            // Optional: If invalid, maybe we want to let them try again?
            // Prompt says: "Invalid code: This code is not valid. Please check the bulletin and try again."
            // "One action per visit... User flow: ... Response is displayed... Student leaves".
            // However, "Please check the bulletin and try again" implies they can try again.
            // But "Response replaces form completely".
            // So they would need to refresh the page. This aligns with "One action per visit".
            // It reinforces the "deliberate" nature.

        } catch (error) {
            console.error('Error:', error);
            // In case of network error
            form.classList.add('hidden');
            instructionZone.classList.add('hidden');
            responseZone.classList.remove('hidden');
            responseMessage.textContent = 'A connection error occurred. Please refresh and try again.';
        }
    });
});
