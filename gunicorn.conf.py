import os
bind    = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
workers = 1      # Keep 1 worker so in-memory OTP store is shared across requests
threads = 4      # Use threads for concurrency instead
timeout = 120
accesslog = "-"
errorlog  = "-"
loglevel  = "info"
