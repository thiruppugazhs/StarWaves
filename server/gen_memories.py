import ast, pathlib
src = open('server/app/services/eve/memories.py', encoding='utf-8').read()
print('lines:', src.count(chr(10)))
