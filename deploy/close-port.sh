for port in 80 443 8001 3000 27017; do
  pid=$(sudo lsof -ti :$port)
  if [ -n "$pid" ]; then
    echo "Killing PID $pid on port $port"
    sudo kill -9 $pid
  else
    echo "Port $port is free"
  fi
done
